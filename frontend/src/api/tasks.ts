import { api } from '@/lib/axios';
import {
  CreateTaskDto,
  UpdateTaskDto,
  TaskResponse,
  TaskQueryParams,
  ConflictCheckResponse,
  ApiResponse,
} from '@smart-task/contracts';

export const taskApi = {
  getTasks: async (params?: TaskQueryParams): Promise<TaskResponse[]> => {
    const response = await api.get<ApiResponse<TaskResponse[]>>('/tasks', { params });
    return response.data.data!;
  },

  getTaskById: async (id: string): Promise<TaskResponse> => {
    const response = await api.get<ApiResponse<TaskResponse>>(`/tasks/${id}`);
    return response.data.data!;
  },

  createTask: async (data: CreateTaskDto): Promise<TaskResponse> => {
    const response = await api.post<ApiResponse<TaskResponse>>('/tasks', data);
    return response.data.data!;
  },

  updateTask: async (id: string, data: UpdateTaskDto): Promise<TaskResponse> => {
    const response = await api.put<ApiResponse<TaskResponse>>(`/tasks/${id}`, data);
    return response.data.data!;
  },

  deleteTask: async (id: string): Promise<void> => {
    await api.delete(`/tasks/${id}`);
  },

  checkConflict: async (data: {
    type: string;
    startDateTime: string;
    deadline?: string;
    excludeTaskId?: string;
  }): Promise<ConflictCheckResponse> => {
    const response = await api.post<ApiResponse<ConflictCheckResponse>>(
      '/tasks/check-conflict',
      data
    );
    return response.data.data!;
  },
};
