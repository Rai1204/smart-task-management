import { z } from 'zod';
import { Priority, TaskType, TaskStatus, PrioritySchema, TaskStatusSchema } from './common.js';

// Task domain model
export interface Task {
  id: string;
  userId: string;
  title: string;
  type: TaskType;
  priority: Priority;
  startDateTime: Date;
  deadline?: Date; // Only for duration tasks
  status?: TaskStatus; // Only for duration tasks
  reminderEnabled: boolean;
  remindersSent: number[]; // Track which reminder quarters have been sent (0, 25, 50, 75, 100)
  createdAt: Date;
  updatedAt: Date;
}

// Task response
export interface TaskResponse {
  id: string;
  userId: string;
  title: string;
  type: TaskType;
  priority: Priority;
  startDateTime: string;
  deadline?: string;
  status?: TaskStatus;
  reminderEnabled: boolean;
  remindersSent: number[];
  createdAt: string;
  updatedAt: string;
}

// Create task DTO
export interface CreateTaskDto {
  title: string;
  type: TaskType;
  priority?: Priority;
  startDateTime: string; // ISO string
  deadline?: string; // ISO string, required for duration tasks
  status?: TaskStatus; // Required for duration tasks
  reminderEnabled?: boolean;
  overrideConflicts?: boolean; // Allow creating task despite conflicts
}

// Update task DTO
export interface UpdateTaskDto {
  title?: string;
  priority?: Priority;
  startDateTime?: string;
  deadline?: string;
  status?: TaskStatus;
  reminderEnabled?: boolean;
  overrideConflicts?: boolean; // Allow updating task despite conflicts
}

// Conflict detection
export interface TaskConflict {
  conflictsWith: string[]; // Array of task IDs
  message: string;
  severity: 'hard' | 'soft';
}

export interface ConflictCheckResponse {
  hasConflict: boolean;
  conflicts: TaskConflict[];
}

// Zod validation schemas
export const CreateReminderTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  type: z.literal(TaskType.REMINDER),
  priority: PrioritySchema.optional().default('medium'),
  startDateTime: z.string().datetime('Invalid date format').refine(
    (date) => new Date(date) > new Date(),
    { message: 'Start date must be in the future' }
  ),
  reminderEnabled: z.boolean().optional().default(false),
});

const BaseDurationTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  type: z.literal(TaskType.DURATION),
  priority: PrioritySchema.optional().default('medium'),
  startDateTime: z.string().datetime('Invalid date format').refine(
    (date) => new Date(date) > new Date(),
    { message: 'Start date must be in the future' }
  ),
  deadline: z.string().datetime('Invalid deadline format'),
  status: TaskStatusSchema.default('pending'),
  reminderEnabled: z.boolean().optional().default(false),
});

export const CreateDurationTaskSchema = BaseDurationTaskSchema.refine(
  (data) => {
    const start = new Date(data.startDateTime);
    const end = new Date(data.deadline);
    const now = new Date();
    return end > start && end > now;
  },
  {
    message: 'Deadline must be after start time and in the future',
    path: ['deadline'],
  }
);

export const CreateTaskSchema = z.union([
  CreateReminderTaskSchema,
  CreateDurationTaskSchema,
]);

export const UpdateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  priority: PrioritySchema.optional(),
  startDateTime: z.string().datetime().optional(),
  deadline: z.string().datetime().optional(),
  status: TaskStatusSchema.optional(),
  reminderEnabled: z.boolean().optional(),
}).refine(
  (data) => {
    if (data.startDateTime && data.deadline) {
      const start = new Date(data.startDateTime);
      const end = new Date(data.deadline);
      return end > start;
    }
    return true;
  },
  {
    message: 'Deadline must be after start time',
    path: ['deadline'],
  }
);

// Infer types
export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;
export type UpdateTaskInput = z.infer<typeof UpdateTaskSchema>;

// Query parameters
export interface TaskQueryParams {
  status?: TaskStatus;
  priority?: Priority;
  type?: TaskType;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}
