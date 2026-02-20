import { z } from 'zod';
import { Priority, TaskType, TaskStatus, PrioritySchema, TaskStatusSchema, RecurrenceFrequency, RecurrenceFrequencySchema } from './common.js';

// Recurrence pattern interface
export interface RecurrencePattern {
  frequency: RecurrenceFrequency;
  interval: number; // e.g., every 2 weeks = interval: 2, frequency: weekly
  endDate?: Date; // When to stop generating recurring tasks
  occurrences?: number; // Alternative to endDate - stop after N occurrences
  daysOfWeek?: number[]; // For weekly: [0=Sun, 1=Mon, ..., 6=Sat]
  dayOfMonth?: number; // For monthly: which day of the month (1-31)
}

// Recurrence pattern for DTOs (uses ISO strings instead of Date)
export interface RecurrencePatternDto {
  frequency: RecurrenceFrequency;
  interval: number;
  endDate?: string; // ISO string
  occurrences?: number;
  daysOfWeek?: number[];
  dayOfMonth?: number;
}

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
  isRecurring: boolean; // Whether this task repeats
  recurrencePattern?: RecurrencePattern; // Recurrence configuration
  parentRecurringTaskId?: string; // If this is an instance of a recurring task, reference to the parent
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
  isRecurring: boolean;
  recurrencePattern?: RecurrencePattern;
  parentRecurringTaskId?: string;
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
  isRecurring?: boolean; // Whether this task repeats
  recurrencePattern?: RecurrencePatternDto; // Recurrence configuration (uses ISO strings)
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
  isRecurring?: boolean;
  recurrencePattern?: RecurrencePatternDto; // Recurrence configuration (uses ISO strings)
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
export const RecurrencePatternSchema = z.object({
  frequency: RecurrenceFrequencySchema,
  interval: z.number().min(1).max(365, 'Interval too large'),
  endDate: z.string().datetime().optional(),
  occurrences: z.number().min(1).max(1000, 'Too many occurrences').optional(),
  daysOfWeek: z.array(z.number().min(0).max(6)).optional(), // For weekly recurrence
  dayOfMonth: z.number().min(1).max(31).optional(), // For monthly recurrence
}).refine(
  (data) => {
    // Must have either endDate or occurrences, not both
    return (data.endDate && !data.occurrences) || (!data.endDate && data.occurrences) || (!data.endDate && !data.occurrences);
  },
  {
    message: 'Specify either endDate or occurrences, not both',
  }
);

export const CreateReminderTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  type: z.literal(TaskType.REMINDER),
  priority: PrioritySchema.optional().default('medium'),
  startDateTime: z.string().datetime('Invalid date format').refine(
    (date) => new Date(date) > new Date(),
    { message: 'Start date must be in the future' }
  ),
  reminderEnabled: z.boolean().optional().default(false),
  isRecurring: z.boolean().optional().default(false),
  recurrencePattern: RecurrencePatternSchema.optional(),
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
  isRecurring: z.boolean().optional().default(false),
  recurrencePattern: RecurrencePatternSchema.optional(),
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
