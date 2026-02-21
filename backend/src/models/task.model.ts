import mongoose, { Schema, Document } from 'mongoose';
import { Task, TaskType, Priority, TaskStatus, RecurrenceFrequency } from '@smart-task/contracts';

export interface TaskDocument extends Omit<Task, 'id'>, Document {}

const recurrencePatternSchema = new Schema(
  {
    frequency: {
      type: String,
      enum: Object.values(RecurrenceFrequency),
      required: true,
    },
    interval: {
      type: Number,
      required: true,
      min: 1,
    },
    endDate: {
      type: Date,
      required: false,
    },
    occurrences: {
      type: Number,
      required: false,
      min: 1,
    },
    daysOfWeek: {
      type: [Number],
      required: false,
    },
    dayOfMonth: {
      type: Number,
      required: false,
      min: 1,
      max: 31,
    },
  },
  { _id: false } // Don't create separate _id for subdocument
);

const taskSchema = new Schema<TaskDocument>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    type: {
      type: String,
      enum: Object.values(TaskType),
      required: true,
    },
    priority: {
      type: String,
      enum: Object.values(Priority),
      default: Priority.MEDIUM,
    },
    startDateTime: {
      type: Date,
      required: true,
    },
    deadline: {
      type: Date,
      required: false,
    },
    status: {
      type: String,
      enum: Object.values(TaskStatus),
      required: false,
    },
    reminderEnabled: {
      type: Boolean,
      default: false,
    },
    remindersSent: {
      type: [Number],
      default: [],
    },
    isRecurring: {
      type: Boolean,
      default: false,
    },
    recurrencePattern: {
      type: recurrencePatternSchema,
      required: false,
    },
    parentRecurringTaskId: {
      type: String,
      required: false,
      index: true,
    },
    dependsOn: {
      type: [String],
      default: [],
      index: true,
    },
    parentTaskId: {
      type: String,
      required: false,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient queries
taskSchema.index({ userId: 1, startDateTime: 1 });
taskSchema.index({ userId: 1, deadline: 1 });
taskSchema.index({ userId: 1, status: 1 });
taskSchema.index({ userId: 1, type: 1 });
taskSchema.index({ userId: 1, parentTaskId: 1 });

// Validate that duration tasks have required fields
taskSchema.pre('save', function (next) {
  if (this.type === TaskType.DURATION) {
    if (!this.deadline) {
      next(new Error('Duration tasks must have a deadline'));
    }
    if (!this.status) {
      this.status = TaskStatus.PENDING;
    }
  } else if (this.type === TaskType.REMINDER) {
    // Reminder tasks should not have deadline but can have status
    this.deadline = undefined;
    // Allow status for reminder tasks (for marking complete)
    if (!this.status) {
      this.status = TaskStatus.PENDING;
    }
  }

  // Validate recurrence pattern
  if (this.isRecurring && !this.recurrencePattern) {
    next(new Error('Recurring tasks must have a recurrence pattern'));
  }
  if (this.recurrencePattern && !this.isRecurring) {
    next(new Error('Non-recurring tasks cannot have a recurrence pattern'));
  }
  
  next();
});

export const TaskModel = mongoose.model<TaskDocument>('Task', taskSchema);
