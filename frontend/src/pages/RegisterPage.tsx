import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { RegisterSchema, RegisterDto } from '@smart-task/contracts';
import { authApi } from '@/api/auth';
import { useAuth } from '@/context/AuthContext';
import { getErrorMessage } from '@/lib/axios';
import ThemeToggle from '@/components/ThemeToggle';
import toast from 'react-hot-toast';

export const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [formData, setFormData] = useState<RegisterDto>({
    email: '',
    password: '',
    name: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const registerMutation = useMutation({
    mutationFn: authApi.register,
    onSuccess: (data) => {
      login(data);
      toast.success('Account created successfully!');
      navigate('/dashboard');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    // Clear error for this field
    if (errors[e.target.name]) {
      setErrors({ ...errors, [e.target.name]: '' });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate with Zod
    const result = RegisterSchema.safeParse(formData);
    if (!result.success) {
      const newErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          newErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(newErrors);
      return;
    }

    registerMutation.mutate(formData);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-primary-100 dark:from-gray-900 dark:to-gray-800 transition-colors duration-300">
      {/* Theme Toggle - Top Right */}
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      
      <div className="card-glass max-w-md w-full mx-4 animate-scale-in">
        <h1 className="text-3xl font-bold text-center mb-2 text-gray-900 dark:text-white">Create Account</h1>
        <p className="text-gray-600 dark:text-gray-400 text-center mb-6">
          Start managing your tasks smartly
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Name</label>
            <input
              type="text"
              name="name"
              value={formData.name}
              onChange={handleChange}
              className={`input ${errors.name ? 'border-red-500 dark:border-red-400' : ''}`}
              placeholder="John Doe"
            />
            {errors.name && (
              <p className="text-red-500 dark:text-red-400 text-sm mt-1">{errors.name}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Email</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className={`input ${errors.email ? 'border-red-500 dark:border-red-400' : ''}`}
              placeholder="john@example.com"
            />
            {errors.email && (
              <p className="text-red-500 dark:text-red-400 text-sm mt-1">{errors.email}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Password</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className={`input ${errors.password ? 'border-red-500 dark:border-red-400' : ''}`}
              placeholder="••••••••"
            />
            {errors.password && (
              <p className="text-red-500 dark:text-red-400 text-sm mt-1">{errors.password}</p>
            )}
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              At least 8 characters with uppercase, lowercase, and number
            </p>
          </div>

          <button
            type="submit"
            disabled={registerMutation.isPending}
            className="btn btn-primary w-full"
          >
            {registerMutation.isPending ? 'Creating account...' : 'Sign Up'}
          </button>
        </form>

        <p className="text-center mt-4 text-sm text-gray-600 dark:text-gray-400">
          Already have an account?{' '}
          <Link to="/login" className="text-primary-600 dark:text-primary-400 hover:underline font-medium">
            Sign In
          </Link>
        </p>
      </div>
    </div>
  );
};
