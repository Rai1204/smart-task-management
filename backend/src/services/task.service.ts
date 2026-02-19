import { TaskModel } from '../models/task.model.js';
import {
  CreateTaskDto,
  UpdateTaskDto,
  TaskResponse,
  TaskQueryParams,
  TaskType,
  TaskStatus,
  TaskConflict,
  ConflictCheckResponse,
} from '@smart-task/contracts';
import { AppError } from '../middleware/errorHandler.js';

export class TaskService {
  /**
   * Check for time conflicts with existing tasks
   */
  async checkConflicts(
    userId: string,
    startDateTime: Date,
    deadline: Date | undefined,
    type: TaskType,
    excludeTaskId?: string
  ): Promise<ConflictCheckResponse> {
    // Get all user's active tasks (not completed or still relevant)
    const query: any = {
      userId,
      ...(excludeTaskId && { _id: { $ne: excludeTaskId } }),
    };

    // Exclude completed duration tasks
    query.$or = [
      { type: TaskType.REMINDER },
      { type: TaskType.DURATION, status: { $ne: TaskStatus.COMPLETED } },
    ];

    const existingTasks = await TaskModel.find(query);

    const conflicts: TaskConflict[] = [];
    const conflictingTaskIds: string[] = [];

    for (const task of existingTasks) {
      const conflict = this.detectConflict(
        { startDateTime, deadline, type },
        {
          startDateTime: task.startDateTime,
          deadline: task.deadline,
          type: task.type,
        }
      );

      if (conflict) {
        conflictingTaskIds.push(task.id);
      }
    }

    if (conflictingTaskIds.length > 0) {
      conflicts.push({
        conflictsWith: conflictingTaskIds,
        message: 'You already have a task scheduled during this time.',
        severity: 'soft', // Can be overridden by user
      });
    }

    return {
      hasConflict: conflicts.length > 0,
      conflicts,
    };
  }

  /**
   * Detect if two tasks conflict in time
   */
  private detectConflict(
    task1: { startDateTime: Date; deadline?: Date; type: TaskType },
    task2: { startDateTime: Date; deadline?: Date; type: TaskType }
  ): boolean {
    const start1 = task1.startDateTime.getTime();
    const end1 = task1.deadline ? task1.deadline.getTime() : start1;

    const start2 = task2.startDateTime.getTime();
    const end2 = task2.deadline ? task2.deadline.getTime() : start2;

    // Both are reminder tasks (point-in-time)
    if (task1.type === TaskType.REMINDER && task2.type === TaskType.REMINDER) {
      return start1 === start2;
    }

    // Task1 is reminder, Task2 is duration
    if (task1.type === TaskType.REMINDER && task2.type === TaskType.DURATION) {
      return start1 >= start2 && start1 <= end2;
    }

    // Task1 is duration, Task2 is reminder
    if (task1.type === TaskType.DURATION && task2.type === TaskType.REMINDER) {
      return start2 >= start1 && start2 <= end1;
    }

    // Both are duration tasks (overlapping ranges)
    if (task1.type === TaskType.DURATION && task2.type === TaskType.DURATION) {
      return start1 < end2 && end1 > start2;
    }

    return false;
  }

  /**
   * Create a new task
   */
  async createTask(userId: string, data: CreateTaskDto): Promise<TaskResponse> {
    const startDateTime = new Date(data.startDateTime);
    const deadline = data.deadline ? new Date(data.deadline) : undefined;

    // Check for conflicts unless explicitly overridden
    if (!data.overrideConflicts) {
      const conflictCheck = await this.checkConflicts(
        userId,
        startDateTime,
        deadline,
        data.type
      );

      if (conflictCheck.hasConflict) {
        // Return conflict information - frontend will handle the decision
        throw new ConflictError('Task conflict detected', conflictCheck);
      }
    }

    // Create task
    const task = await TaskModel.create({
      userId,
      title: data.title,
      type: data.type,
      priority: data.priority || 'medium',
      startDateTime,
      deadline,
      status: data.status,
      reminderEnabled: data.reminderEnabled || false,
      remindersSent: [],
    });

    return this.toTaskResponse(task);
  }

  /**
   * Get all tasks for a user with optional filtering
   */
  async getTasks(userId: string, params: TaskQueryParams): Promise<TaskResponse[]> {
    const query: any = { userId };

    if (params.status) {
      query.status = params.status;
    }

    if (params.priority) {
      query.priority = params.priority;
    }

    if (params.type) {
      query.type = params.type;
    }

    if (params.startDate || params.endDate) {
      query.startDateTime = {};
      if (params.startDate) {
        query.startDateTime.$gte = new Date(params.startDate);
      }
      if (params.endDate) {
        query.startDateTime.$lte = new Date(params.endDate);
      }
    }

    const tasks = await TaskModel.find(query).sort({ startDateTime: 1 });

    return tasks.map((task) => this.toTaskResponse(task));
  }

  /**
   * Get a single task by ID
   */
  async getTaskById(userId: string, taskId: string): Promise<TaskResponse> {
    const task = await TaskModel.findOne({ _id: taskId, userId });

    if (!task) {
      throw new AppError('Task not found', 404);
    }

    return this.toTaskResponse(task);
  }

  /**
   * Update a task
   */
  async updateTask(
    userId: string,
    taskId: string,
    data: UpdateTaskDto
  ): Promise<TaskResponse> {
    const task = await TaskModel.findOne({ _id: taskId, userId });

    if (!task) {
      throw new AppError('Task not found', 404);
    }

    // Check for conflicts if time is being updated (unless explicitly overridden)
    if ((data.startDateTime || data.deadline) && !data.overrideConflicts) {
      const startDateTime = data.startDateTime
        ? new Date(data.startDateTime)
        : task.startDateTime;
      const deadline = data.deadline ? new Date(data.deadline) : task.deadline;

      const conflictCheck = await this.checkConflicts(
        userId,
        startDateTime,
        deadline,
        task.type,
        taskId
      );

      if (conflictCheck.hasConflict) {
        throw new ConflictError('Task conflict detected', conflictCheck);
      }
    }

    // Update fields
    if (data.title !== undefined) task.title = data.title;
    if (data.priority !== undefined) task.priority = data.priority;
    if (data.startDateTime !== undefined)
      task.startDateTime = new Date(data.startDateTime);
    if (data.deadline !== undefined) task.deadline = new Date(data.deadline);
    if (data.status !== undefined) task.status = data.status;
    if (data.reminderEnabled !== undefined)
      task.reminderEnabled = data.reminderEnabled;

    // If task is marked as completed, stop reminders
    if (data.status === TaskStatus.COMPLETED) {
      task.reminderEnabled = false;
    }

    await task.save();

    return this.toTaskResponse(task);
  }

  /**
   * Delete a task
   */
  async deleteTask(userId: string, taskId: string): Promise<void> {
    const result = await TaskModel.deleteOne({ _id: taskId, userId });

    if (result.deletedCount === 0) {
      throw new AppError('Task not found', 404);
    }
  }

  /**
   * Get tasks eligible for reminders
   */
  async getTasksForReminders(): Promise<TaskResponse[]> {
    const now = new Date();

    // Get all tasks with reminders enabled and not completed
    const query: any = {
      reminderEnabled: true,
      $or: [
        { type: TaskType.REMINDER, startDateTime: { $gte: now } },
        {
          type: TaskType.DURATION,
          status: { $ne: TaskStatus.COMPLETED },
          deadline: { $gte: now },
        },
      ],
    };

    const tasks = await TaskModel.find(query);
    return tasks.map((task) => this.toTaskResponse(task));
  }

  /**
   * Update reminder status for a task
   */
  async updateReminderSent(taskId: string, quarter: number): Promise<void> {
    await TaskModel.findByIdAndUpdate(taskId, {
      $addToSet: { remindersSent: quarter },
    });
  }

  /**
   * Convert task document to response format
   */
  private toTaskResponse(task: any): TaskResponse {
    return {
      id: task.id,
      userId: task.userId,
      title: task.title,
      type: task.type,
      priority: task.priority,
      startDateTime: task.startDateTime.toISOString(),
      deadline: task.deadline ? task.deadline.toISOString() : undefined,
      status: task.status,
      reminderEnabled: task.reminderEnabled,
      remindersSent: task.remindersSent,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    };
  }
}

// Custom error for conflicts
export class ConflictError extends AppError {
  conflictInfo: ConflictCheckResponse;

  constructor(message: string, conflictInfo: ConflictCheckResponse) {
    super(message, 409);
    this.conflictInfo = conflictInfo;
  }
}

export const taskService = new TaskService();
