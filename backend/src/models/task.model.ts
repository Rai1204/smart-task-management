import mongoose, { Schema, Document } from 'mongoose';
import { Task, TaskType, Priority, TaskStatus } from '@smart-task/contracts';

export interface TaskDocument extends Omit<Task, 'id'>, Document {}

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
  next();
});

export const TaskModel = mongoose.model<TaskDocument>('Task', taskSchema);
