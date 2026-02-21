import { api } from '@/lib/axios';
import {
  CreateProjectDto,
  UpdateProjectDto,
  ProjectResponse,
  ProjectQueryParams,
  ApiResponse,
} from '@smart-task/contracts';

export const projectApi = {
  getProjects: async (params?: ProjectQueryParams): Promise<ProjectResponse[]> => {
    const response = await api.get<ApiResponse<ProjectResponse[]>>('/projects', { params });
    return response.data.data!;
  },

  getProjectById: async (id: string): Promise<ProjectResponse> => {
    const response = await api.get<ApiResponse<ProjectResponse>>(`/projects/${id}`);
    return response.data.data!;
  },

  createProject: async (data: CreateProjectDto): Promise<ProjectResponse> => {
    const response = await api.post<ApiResponse<ProjectResponse>>('/projects', data);
    return response.data.data!;
  },

  updateProject: async (id: string, data: UpdateProjectDto): Promise<ProjectResponse> => {
    const response = await api.put<ApiResponse<ProjectResponse>>(`/projects/${id}`, data);
    return response.data.data!;
  },

  deleteProject: async (id: string): Promise<void> => {
    await api.delete(`/projects/${id}`);
  },
};
