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
  RecurrenceFrequency,
  RecurrencePattern,
  Priority,
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

    const existingTasks = await TaskModel.find(query).sort({ startDateTime: 1 });

    const conflicts: TaskConflict[] = [];
    const conflictingTaskIds: string[] = [];

    for (const task of existingTasks) {
      const conflict =this.detectConflict(
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

    const response: ConflictCheckResponse = {
      hasConflict: conflicts.length > 0 || conflictingTaskIds.length > 0,
      conflicts: [],
      suggestions: undefined,
      taskDuration: undefined,
    };

    if (conflictingTaskIds.length > 0) {
      conflicts.push({
        conflictsWith: conflictingTaskIds,
        message: 'You already have a task scheduled during this time.',
        severity: 'soft', // Can be overridden by user
      });

      response.conflicts = conflicts;

      // Only provide suggestions for duration tasks
      if (type === TaskType.DURATION && deadline) {
        const taskDuration = deadline.getTime() - startDateTime.getTime();
        response.taskDuration = taskDuration;

        // Find free time slots
        const suggestions = this.findFreeTimeSlots(
          existingTasks,
          taskDuration,
          startDateTime
        );
        response.suggestions = suggestions;
      }
    }

    return response;
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
   * Check if adding a task would exceed 24 hours in a single day
   */
  private async checkDailyHourLimit(
    userId: string,
    startDateTime: Date,
    deadline: Date | undefined,
    type: TaskType,
    excludeTaskId?: string
  ): Promise<{ exceeds: boolean; maxDay?: string; maxHours?: number }> {
    // Only check for duration tasks
    if (type !== TaskType.DURATION || !deadline) {
      return { exceeds: false };
    }

    // Get all duration tasks for the user (including completed to match workload display)
    const query: any = {
      userId,
      type: TaskType.DURATION,
      ...(excludeTaskId && { _id: { $ne: excludeTaskId } }),
    };

    const existingTasks = await TaskModel.find(query);

    // Calculate hours per day including the new task
    const dailyHours = new Map<string, number>();

    // Helper function to add hours for a task across days it spans
    const addTaskHours = (taskStart: Date, taskEnd: Date) => {
      let currentDay = new Date(taskStart);
      currentDay.setHours(0, 0, 0, 0);
      
      const lastDay = new Date(taskEnd);
      lastDay.setHours(0, 0, 0, 0);

      while (currentDay <= lastDay) {
        // Use local date string instead of ISO to avoid timezone shifts
        const year = currentDay.getFullYear();
        const month = String(currentDay.getMonth() + 1).padStart(2, '0');
        const day = String(currentDay.getDate()).padStart(2, '0');
        const dateKey = `${year}-${month}-${day}`;
        
        const dayStart = new Date(currentDay);
        const dayEnd = new Date(currentDay);
        dayEnd.setHours(23, 59, 59, 999);
        
        const effectiveStart = new Date(Math.max(taskStart.getTime(), dayStart.getTime()));
        const effectiveEnd = new Date(Math.min(taskEnd.getTime(), dayEnd.getTime()));
        
        const hoursOnThisDay = (effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60);

        if (hoursOnThisDay > 0) {
          dailyHours.set(dateKey, (dailyHours.get(dateKey) || 0) + hoursOnThisDay);
        }
        
        currentDay.setDate(currentDay.getDate() + 1);
      }
    };

    // Add hours from existing tasks
    for (const task of existingTasks) {
      const taskEnd = task.deadline || task.startDateTime;
      addTaskHours(task.startDateTime, taskEnd);
    }

    // Add hours from the new task
    addTaskHours(startDateTime, deadline);

    // Check if any day exceeds 24 hours
    let maxHours = 0;
    let maxDay = '';
    
    for (const [day, hours] of dailyHours.entries()) {
      if (hours > maxHours) {
        maxHours = hours;
        maxDay = day;
      }
    }

    if (maxHours > 24) {
      return { exceeds: true, maxDay, maxHours };
    }

    return { exceeds: false };
  }

  /**
   * Find free time slots where a task of given duration can fit
   */
  private findFreeTimeSlots(
    existingTasks: any[],
    taskDuration: number,
    originalStart: Date
  ): import('@smart-task/contracts').TimeSuggestion[] {
    const suggestions: import('@smart-task/contracts').TimeSuggestion[] = [];
    const now = new Date();
    
    // Start searching from the original start time or now, whichever is later
    let searchStart = new Date(Math.max(originalStart.getTime(), now.getTime()));
    
    // Search window: 7 days ahead
    const searchEnd = new Date(searchStart.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Convert existing tasks to time blocks
    const busyBlocks = existingTasks
      .map((task) => {
        const start = task.startDateTime.getTime();
        const end = task.deadline ? task.deadline.getTime() : start;
        return { start, end };
      })
      .sort((a, b) => a.start - b.start);

    // Find gaps between busy blocks
    let currentTime = searchStart.getTime();
    
    for (const block of busyBlocks) {
      // Check if there's a gap before this block
      const gapDuration = block.start - currentTime;
      
      if (gapDuration >= taskDuration) {
        // Found a free slot!
        const slotStart = new Date(currentTime);
        const slotEnd = new Date(currentTime + taskDuration);
        
        suggestions.push({
          startDateTime: slotStart.toISOString(),
          deadline: slotEnd.toISOString(),
          reason: `Free slot before your next task`,
        });
        
        // Limit to 3 suggestions
        if (suggestions.length >= 3) {
          break;
        }
      }
      
      // Move to the end of this block
      currentTime = Math.max(currentTime, block.end);
    }

    // Check if there's space after all tasks
    if (suggestions.length < 3 && currentTime < searchEnd.getTime()) {
      const slotStart = new Date(currentTime);
      const slotEnd = new Date(currentTime + taskDuration);
      
      if (slotEnd.getTime() <= searchEnd.getTime()) {
        suggestions.push({
          startDateTime: slotStart.toISOString(),
          deadline: slotEnd.toISOString(),
          reason: `Available after your scheduled tasks`,
        });
      }
    }

    // If no gaps found in existing schedule, suggest times after current tasks
    if (suggestions.length === 0) {
      // Suggest right after the last task
      const lastBlock = busyBlocks[busyBlocks.length - 1];
      if (lastBlock) {
        const slotStart = new Date(lastBlock.end);
        const slotEnd = new Date(lastBlock.end + taskDuration);
        
        suggestions.push({
          startDateTime: slotStart.toISOString(),
          deadline: slotEnd.toISOString(),
          reason: `First available time after your tasks`,
        });
      }
    }

    return suggestions;
  }

  /**
   * Calculate next occurrence date based on recurrence pattern
   */
  private calculateNextOccurrence(
    currentDate: Date,
    pattern: RecurrencePattern
  ): Date | null {
    const next = new Date(currentDate);

    switch (pattern.frequency) {
      case RecurrenceFrequency.DAILY:
        next.setDate(next.getDate() + pattern.interval);
        break;

      case RecurrenceFrequency.WEEKLY:
        if (pattern.daysOfWeek && pattern.daysOfWeek.length > 0) {
          // Find next day of week from the daysOfWeek array
          const currentDay = next.getDay();
          const sortedDays = [...pattern.daysOfWeek].sort((a, b) => a - b);
          
          let foundNext = false;
          for (const day of sortedDays) {
            if (day > currentDay) {
              next.setDate(next.getDate() + (day - currentDay));
              foundNext = true;
              break;
            }
          }
          
          if (!foundNext) {
            // Wrap to next week, first day in pattern
            const daysUntilNext = (7 - currentDay + sortedDays[0]) * pattern.interval;
            next.setDate(next.getDate() + daysUntilNext);
          }
        } else {
          next.setDate(next.getDate() + (7 * pattern.interval));
        }
        break;

      case RecurrenceFrequency.MONTHLY:
        if (pattern.dayOfMonth) {
          next.setMonth(next.getMonth() + pattern.interval);
          next.setDate(pattern.dayOfMonth);
        } else {
          next.setMonth(next.getMonth() + pattern.interval);
        }
        break;

      case RecurrenceFrequency.YEARLY:
        next.setFullYear(next.getFullYear() + pattern.interval);
        break;

      default:
        return null;
    }

    return next;
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
      
      // Check daily hour limit (24 hours max per day)
      const dailyLimitCheck = await this.checkDailyHourLimit(
        userId,
        startDateTime,
        deadline,
        data.type
      );
      
      if (dailyLimitCheck.exceeds) {
        const date = new Date(dailyLimitCheck.maxDay!);
        const formattedDate = date.toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });
        throw new AppError(
          `Cannot schedule task: ${formattedDate} would have ${dailyLimitCheck.maxHours!.toFixed(1)} hours (max 24 hours per day). Please adjust the task duration or reschedule.`,
          400
        );
      }
    }

    // Prepare recurrence pattern if provided
    const recurrencePattern = data.recurrencePattern ? {
      frequency: data.recurrencePattern.frequency,
      interval: data.recurrencePattern.interval,
      endDate: data.recurrencePattern.endDate ? new Date(data.recurrencePattern.endDate) : undefined,
      occurrences: data.recurrencePattern.occurrences,
      daysOfWeek: data.recurrencePattern.daysOfWeek,
      dayOfMonth: data.recurrencePattern.dayOfMonth,
    } : undefined;

    // Validate dependencies exist and belong to the user
    if (data.dependsOn && data.dependsOn.length > 0) {
      const dependencies = await TaskModel.find({
        _id: { $in: data.dependsOn },
        userId,
      });
      
      if (dependencies.length !== data.dependsOn.length) {
        throw new AppError('One or more dependency tasks not found', 400);
      }
    }

    // Validate parent task exists and belongs to the user
    if (data.parentTaskId) {
      const parentTask = await TaskModel.findOne({
        _id: data.parentTaskId,
        userId,
      });
      
      if (!parentTask) {
        throw new AppError('Parent task not found', 400);
      }
      
      // Prevent circular relationships - check if parent is already a subtask of this task
      // (Not applicable for new tasks, but added for consistency)
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
      isRecurring: data.isRecurring || false,
      recurrencePattern,
      dependsOn: data.dependsOn || [],
      parentTaskId: data.parentTaskId,
      projectId: data.projectId,
    });

    // Note: Recurring tasks are stored as single task with pattern
    // The frontend will calculate and display the current occurrence

    return await this.toTaskResponse(task);
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

    return await Promise.all(tasks.map((task) => this.toTaskResponse(task)));
  }

  /**
   * Get a single task by ID
   */
  async getTaskById(userId: string, taskId: string): Promise<TaskResponse> {
    const task = await TaskModel.findOne({ _id: taskId, userId });

    if (!task) {
      throw new AppError('Task not found', 404);
    }

    return await this.toTaskResponse(task);
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
      
      // Check daily hour limit (24 hours max per day)
      const dailyLimitCheck = await this.checkDailyHourLimit(
        userId,
        startDateTime,
        deadline,
        task.type,
        taskId
      );
      
      if (dailyLimitCheck.exceeds) {
        const date = new Date(dailyLimitCheck.maxDay!);
        const formattedDate = date.toLocaleDateString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });
        throw new AppError(
          `Cannot update task: ${formattedDate} would have ${dailyLimitCheck.maxHours!.toFixed(1)} hours (max 24 hours per day). Please adjust the task duration or reschedule.`,
          400
        );
      }
    }

    // Update fields
    if (data.title !== undefined) task.title = data.title;
    if (data.priority !== undefined) task.priority = data.priority;
    if (data.startDateTime !== undefined)
      task.startDateTime = new Date(data.startDateTime);
    if (data.deadline !== undefined) task.deadline = new Date(data.deadline);
    if (data.reminderEnabled !== undefined)
      task.reminderEnabled = data.reminderEnabled;
    
    // Update dependencies if provided
    if (data.dependsOn !== undefined) {
      // Validate dependencies exist and belong to the user
      if (data.dependsOn.length > 0) {
        const dependencies = await TaskModel.find({
          _id: { $in: data.dependsOn },
          userId,
        });
        
        if (dependencies.length !== data.dependsOn.length) {
          throw new AppError('One or more dependency tasks not found', 400);
        }
      }
      task.dependsOn = data.dependsOn;
    }

    // Update parent task if provided
    if (data.parentTaskId !== undefined) {
      if (data.parentTaskId) {
        // Validate parent task exists and belongs to the user
        const parentTask = await TaskModel.findOne({
          _id: data.parentTaskId,
          userId,
        });
        
        if (!parentTask) {
          throw new AppError('Parent task not found', 400);
        }
        
        // Prevent circular relationships - check if the new parent is a subtask of this task
        if (await this.isSubtaskOf(data.parentTaskId, taskId, userId)) {
          throw new AppError('Cannot set parent - would create circular relationship', 400);
        }
      }
      task.parentTaskId = data.parentTaskId;
    }

    // Update project if provided
    if (data.projectId !== undefined) {
      task.projectId = data.projectId;
    }

    // Validate completion - check if this task has incomplete subtasks
    if (data.status === TaskStatus.COMPLETED) {
      const incompleteSubtasks = await TaskModel.find({
        userId,
        parentTaskId: taskId,
        status: { $ne: TaskStatus.COMPLETED }
      });
      
      if (incompleteSubtasks.length > 0) {
        const subtaskTitles = incompleteSubtasks.map(s => s.title).join(', ');
        throw new AppError(
          `Cannot complete parent task - the following subtasks must be completed first: ${subtaskTitles}`,
          400
        );
      }
    }

    // Validate status change - check if dependencies are complete
    if (data.status === TaskStatus.IN_PROGRESS && task.dependsOn && task.dependsOn.length > 0) {
      const incompleteDeps = await TaskModel.find({
        _id: { $in: task.dependsOn },
        status: { $ne: TaskStatus.COMPLETED }
      });
      
      if (incompleteDeps.length > 0) {
        const depTitles = incompleteDeps.map(d => d.title).join(', ');
        throw new AppError(
          `Cannot start task - the following dependencies must be completed first: ${depTitles}`,
          400
        );
      }
    }

    // Validate completion - also check if dependencies are complete
    if (data.status === TaskStatus.COMPLETED && task.dependsOn && task.dependsOn.length > 0) {
      const incompleteDeps = await TaskModel.find({
        _id: { $in: task.dependsOn },
        status: { $ne: TaskStatus.COMPLETED }
      });
      
      if (incompleteDeps.length > 0) {
        const depTitles = incompleteDeps.map(d => d.title).join(', ');
        throw new AppError(
          `Cannot complete task - the following dependencies must be completed first: ${depTitles}`,
          400
        );
      }
    }

    // Handle recurring task completion
    if (data.status === TaskStatus.COMPLETED && task.isRecurring && task.recurrencePattern) {
      // Store original start time for deadline calculation
      const originalStartTime = new Date(task.startDateTime);
      
      // Check if this is occurrence-based and we've reached the last occurrence
      if (task.recurrencePattern.occurrences !== undefined) {
        if (task.recurrencePattern.occurrences <= 1) {
          // This was the last occurrence - mark series as completed
          task.status = TaskStatus.COMPLETED;
          task.reminderEnabled = false;
        } else {
          // Decrement occurrences count
          task.recurrencePattern.occurrences -= 1;
          
          // Calculate next occurrence
          const nextOccurrence = this.calculateNextOccurrence(task.startDateTime, task.recurrencePattern);
          
          if (nextOccurrence) {
            // Move to next occurrence
            task.startDateTime = nextOccurrence;
            
            // If duration task, adjust deadline by same time difference
            if (task.deadline && task.type === TaskType.DURATION) {
              const timeDiff = task.deadline.getTime() - originalStartTime.getTime();
              task.deadline = new Date(nextOccurrence.getTime() + timeDiff);
            }
            
            // Reset for next occurrence
            task.status = TaskStatus.PENDING;
            task.remindersSent = [];
          } else {
            // Can't calculate next occurrence - mark as completed
            task.status = TaskStatus.COMPLETED;
            task.reminderEnabled = false;
          }
        }
      } else {
        // Date-based recurrence or never-ending
        // Calculate next occurrence
        const nextOccurrence = this.calculateNextOccurrence(task.startDateTime, task.recurrencePattern);
        
        if (nextOccurrence) {
          // Check if next occurrence exceeds end date
          const endDate = task.recurrencePattern.endDate;
          if (endDate && nextOccurrence > endDate) {
            // Series ended - mark as completed
            task.status = TaskStatus.COMPLETED;
            task.reminderEnabled = false;
          } else {
            // Move to next occurrence
            task.startDateTime = nextOccurrence;
            
            // If duration task, adjust deadline by same time difference
            if (task.deadline && task.type === TaskType.DURATION) {
              const timeDiff = task.deadline.getTime() - originalStartTime.getTime();
              task.deadline = new Date(nextOccurrence.getTime() + timeDiff);
            }
            
            // Reset for next occurrence
            task.status = TaskStatus.PENDING;
            task.remindersSent = [];
            // Keep reminderEnabled as is (user's preference)
          }
        } else {
          // No more occurrences - mark as completed
          task.status = TaskStatus.COMPLETED;
          task.reminderEnabled = false;
        }
      }
    } else if (data.status !== undefined) {
      // Non-recurring task or status change other than completion
      task.status = data.status;
      
      // If task is marked as completed, stop reminders
      if (data.status === TaskStatus.COMPLETED) {
        task.reminderEnabled = false;
      }
    }

    await task.save();

    // If this is a subtask that was just completed, check if parent should auto-complete
    if (task.parentTaskId && data.status === TaskStatus.COMPLETED) {
      await this.checkAndCompleteParent(userId, task.parentTaskId);
    }

    return await this.toTaskResponse(task);
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
   * Check if a task is a subtask of another (for preventing circular relationships)
   */
  private async isSubtaskOf(
    potentialParentId: string,
    potentialChildId: string,
    userId: string
  ): Promise<boolean> {
    // Check if potentialParentId is already a subtask of potentialChildId
    // This would create a circular relationship
    let currentTask = await TaskModel.findOne({ _id: potentialParentId, userId });
    
    while (currentTask && currentTask.parentTaskId) {
      if (currentTask.parentTaskId === potentialChildId) {
        return true; // Circular relationship detected
      }
      currentTask = await TaskModel.findOne({ _id: currentTask.parentTaskId, userId });
    }
    
    return false;
  }

  /**
   * Get all subtasks of a parent task
   */
  private async getSubtasks(userId: string, parentTaskId: string): Promise<string[]> {
    const subtasks = await TaskModel.find({
      userId,
      parentTaskId,
    }).select('_id');
    
    return subtasks.map(task => task.id);
  }

  /**
   * Calculate progress percentage based on completed subtasks
   * Returns 0-100, or undefined if no subtasks
   */
  private async calculateProgress(userId: string, taskId: string): Promise<number | undefined> {
    const subtasks = await TaskModel.find({
      userId,
      parentTaskId: taskId,
    });
    
    if (subtasks.length === 0) {
      return undefined; // No subtasks, no progress to calculate
    }
    
    const completedCount = subtasks.filter(
      task => task.status === TaskStatus.COMPLETED
    ).length;
    
    return Math.round((completedCount / subtasks.length) * 100);
  }

  /**
   * Check if all subtasks are completed and auto-complete parent if so
   */
  private async checkAndCompleteParent(userId: string, parentTaskId: string): Promise<void> {
    const subtasks = await TaskModel.find({
      userId,
      parentTaskId,
    });
    
    // Check if all subtasks are completed
    const allCompleted = subtasks.length > 0 && subtasks.every(
      task => task.status === TaskStatus.COMPLETED
    );
    
    if (allCompleted) {
      // Auto-complete the parent task
      const parentTask = await TaskModel.findOne({ _id: parentTaskId, userId });
      if (parentTask && parentTask.status !== TaskStatus.COMPLETED) {
        parentTask.status = TaskStatus.COMPLETED;
        if (parentTask.type === TaskType.DURATION) {
          parentTask.reminderEnabled = false;
        }
        await parentTask.save();
      }
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
    return await Promise.all(tasks.map((task) => this.toTaskResponse(task)));
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
  private async toTaskResponse(task: any): Promise<TaskResponse> {
    const dependsOn = task.dependsOn || [];
    
    // Calculate if task is blocked (has incomplete dependencies)
    let blockedBy: string[] = [];
    let isBlocked = false;
    
    if (dependsOn.length > 0) {
      const dependencies = await TaskModel.find({ 
        _id: { $in: dependsOn },
        status: { $ne: TaskStatus.COMPLETED }
      });
      
      blockedBy = dependencies.map(d => d.id);
      isBlocked = blockedBy.length > 0;
    }

    // Get subtasks and calculate progress
    const subtasks = await this.getSubtasks(task.userId, task.id);
    const progress = await this.calculateProgress(task.userId, task.id);

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
      isRecurring: task.isRecurring || false,
      recurrencePattern: task.recurrencePattern ? {
        frequency: task.recurrencePattern.frequency,
        interval: task.recurrencePattern.interval,
        endDate: task.recurrencePattern.endDate?.toISOString(),
        occurrences: task.recurrencePattern.occurrences,
        daysOfWeek: task.recurrencePattern.daysOfWeek,
        dayOfMonth: task.recurrencePattern.dayOfMonth,
      } : undefined,
      parentRecurringTaskId: task.parentRecurringTaskId,
      dependsOn,
      blockedBy,
      isBlocked,
      parentTaskId: task.parentTaskId,
      subtasks: subtasks.length > 0 ? subtasks : undefined,
      progress,
      projectId: task.projectId,
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    };
  }

  /**
   * Calculate dynamic priority based on deadline proximity and base priority
   * Returns a score where higher = more urgent
   */
  calculateDynamicPriority(task: TaskResponse, now: Date = new Date()): number {
    // Base priority scores
    const priorityScores = {
      [Priority.LOW]: 1,
      [Priority.MEDIUM]: 2,
      [Priority.HIGH]: 3,
    };

    let score = priorityScores[task.priority] * 10;

    // For tasks with deadlines, adjust based on time remaining
    if (task.deadline) {
      const deadline = new Date(task.deadline);
      const hoursUntilDeadline = (deadline.getTime() - now.getTime()) / (1000 * 60 * 60);

      // Urgency multiplier based on hours remaining
      if (hoursUntilDeadline < 0) {
        // Overdue - highest priority
        score += 100;
      } else if (hoursUntilDeadline < 2) {
        // Less than 2 hours - critical
        score += 50;
      } else if (hoursUntilDeadline < 6) {
        // Less than 6 hours - very urgent
        score += 30;
      } else if (hoursUntilDeadline < 24) {
        // Less than 24 hours - urgent
        score += 20;
      } else if (hoursUntilDeadline < 48) {
        // Less than 2 days - moderately urgent
        score += 10;
      } else if (hoursUntilDeadline < 168) {
        // Less than 1 week
        score += 5;
      }
    }

    // In-progress tasks get a boost
    if (task.status === TaskStatus.IN_PROGRESS) {
      score += 15;
    }

    // Completed tasks should be at the bottom
    if (task.status === TaskStatus.COMPLETED) {
      score = -1000;
    }

    return score;
  }

  /**
   * Sort tasks by dynamic priority
   */
  sortByDynamicPriority(tasks: TaskResponse[]): TaskResponse[] {
    const now = new Date();
    return tasks.sort((a, b) => {
      const scoreA = this.calculateDynamicPriority(a, now);
      const scoreB = this.calculateDynamicPriority(b, now);
      return scoreB - scoreA; // Higher score first
    });
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
