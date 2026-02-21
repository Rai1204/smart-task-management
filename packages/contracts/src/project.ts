import { z } from 'zod';

// Project domain model
export interface Project {
  id: string;
  userId: string;
  name: string;
  description?: string;
  color: string; // Hex color code for visual identification
  deadline?: Date;
  createdAt: Date;
  updatedAt: Date;
}

// Project response
export interface ProjectResponse {
  id: string;
  userId: string;
  name: string;
  description?: string;
  color: string;
  deadline?: string;
  taskCount?: number; // Number of tasks in this project
  completedTaskCount?: number; // Number of completed tasks
  progress?: number; // Completion percentage 0-100
  createdAt: string;
  updatedAt: string;
}

// Create project DTO
export interface CreateProjectDto {
  name: string;
  description?: string;
  color?: string; // Default to random color if not provided
  deadline?: string; // ISO string
}

// Update project DTO
export interface UpdateProjectDto {
  name?: string;
  description?: string;
  color?: string;
  deadline?: string;
}

// Predefined color palette for projects
export const PROJECT_COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // orange
  '#EF4444', // red
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#84CC16', // lime
  '#F97316', // orange-alt
  '#6366F1', // indigo
];

// Zod validation schemas
export const CreateProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(100, 'Name too long'),
  description: z.string().max(500, 'Description too long').optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, 'Invalid color format').optional(),
  deadline: z.string()
    .refine((val) => {
      if (!val) return true;
      // Accept both date (YYYY-MM-DD) and datetime formats
      const dateRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/;
      return dateRegex.test(val);
    }, 'Invalid date format')
    .refine((val) => {
      if (!val) return true;
      const inputDate = new Date(val);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return inputDate >= today;
    }, 'Deadline cannot be in the past')
    .optional(),
});

export const UpdateProjectSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i, 'Invalid color format').optional(),
  deadline: z.string()
    .refine((val) => {
      if (!val) return true;
      // Accept both date (YYYY-MM-DD) and datetime formats
      const dateRegex = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?)?$/;
      return dateRegex.test(val);
    }, 'Invalid date format')
    .refine((val) => {
      if (!val) return true;
      const inputDate = new Date(val);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return inputDate >= today;
    }, 'Deadline cannot be in the past')
    .optional(),
});

// Infer types
export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;
export type UpdateProjectInput = z.infer<typeof UpdateProjectSchema>;

// Query parameters
export interface ProjectQueryParams {
  page?: number;
  limit?: number;
}
