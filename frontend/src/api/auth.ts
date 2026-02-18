import { api } from '@/lib/axios';
import {
  RegisterDto,
  LoginDto,
  AuthResponse,
  ApiResponse,
} from '@smart-task/contracts';

export const authApi = {
  register: async (data: RegisterDto): Promise<AuthResponse> => {
    const response = await api.post<ApiResponse<AuthResponse>>('/auth/register', data);
    return response.data.data!;
  },

  login: async (data: LoginDto): Promise<AuthResponse> => {
    const response = await api.post<ApiResponse<AuthResponse>>('/auth/login', data);
    return response.data.data!;
  },
};
