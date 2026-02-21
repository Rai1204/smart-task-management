import mongoose, { Schema, Document } from 'mongoose';
import { Project } from '@smart-task/contracts';

export interface ProjectDocument extends Omit<Project, 'id'>, Document {}

const projectSchema = new Schema<ProjectDocument>(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    color: {
      type: String,
      required: true,
      match: /^#[0-9A-F]{6}$/i,
    },
    deadline: {
      type: Date,
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for efficient queries
projectSchema.index({ userId: 1, createdAt: -1 });
projectSchema.index({ userId: 1, deadline: 1 });

export const ProjectModel = mongoose.model<ProjectDocument>('Project', projectSchema);
