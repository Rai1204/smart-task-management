import { z } from 'zod';

// Common enums
export enum Priority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

export enum TaskType {
  REMINDER = 'reminder',
  DURATION = 'duration',
}

export enum TaskStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in-progress',
  COMPLETED = 'completed',
}

// Zod schemas for validation
export const PrioritySchema = z.enum(['low', 'medium', 'high']);
export const TaskTypeSchema = z.enum(['reminder', 'duration']);
export const TaskStatusSchema = z.enum(['pending', 'in-progress', 'completed']);

// Common response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// Error response
export interface ErrorResponse {
  success: false;
  error: string;
  statusCode: number;
  details?: unknown;
}
