import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CreateProjectDto,
  ProjectResponse,
  CreateProjectSchema,
  PROJECT_COLORS,
} from '@smart-task/contracts';
import { projectApi } from '@/api/projects';
import { getErrorMessage } from '@/lib/axios';
import toast from 'react-hot-toast';

interface ProjectFormProps {
  project?: ProjectResponse | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ProjectForm: React.FC<ProjectFormProps> = ({ project, onClose, onSuccess }) => {
  const isEditing = !!project;
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState<CreateProjectDto>({
    name: project?.name || '',
    description: project?.description || '',
    color: project?.color || PROJECT_COLORS[0],
    deadline: project?.deadline ? new Date(project.deadline).toISOString().split('T')[0] : undefined,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const createProjectMutation = useMutation({
    mutationFn: isEditing
      ? (data: CreateProjectDto) => projectApi.updateProject(project!.id, data)
      : projectApi.createProject,
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success(isEditing ? 'Project updated successfully!' : 'Project created successfully!');
      onSuccess?.();
      onClose();
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validate with Zod
    const result = CreateProjectSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        const path = err.path[0] as string;
        fieldErrors[path] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    createProjectMutation.mutate(formData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    if (errors[name]) {
      setErrors({ ...errors, [name]: '' });
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              {isEditing ? 'Edit Project' : 'Create New Project'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl"
            >
              ×
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Project Name */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Project Name *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className={`input ${errors.name ? 'border-red-500' : ''}`}
                placeholder="e.g., Website Redesign"
              />
              {errors.name && (
                <p className="text-red-500 text-xs mt-1">{errors.name}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Description (optional)
              </label>
              <textarea
                name="description"
                value={formData.description || ''}
                onChange={handleChange}
                rows={3}
                className={`input ${errors.description ? 'border-red-500' : ''}`}
                placeholder="Brief description of the project..."
              />
              {errors.description && (
                <p className="text-red-500 text-xs mt-1">{errors.description}</p>
              )}
            </div>

            {/* Color Picker */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Project Color
              </label>
              <div className="grid grid-cols-5 gap-2">
                {PROJECT_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setFormData({ ...formData, color })}
                    className={`h-10 rounded-md border-2 transition-all ${
                      formData.color === color
                        ? 'border-gray-900 scale-110'
                        : 'border-gray-300 hover:border-gray-400'
                    }`}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            </div>

            {/* Deadline */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Deadline (optional)
              </label>
              <input
                type="date"
                name="deadline"
                value={formData.deadline || ''}
                onChange={handleChange}
                min={new Date().toISOString().split('T')[0]}
                className={`input ${errors.deadline ? 'border-red-500' : ''}`}
              />
              {errors.deadline && (
                <p className="text-red-500 text-xs mt-1">{errors.deadline}</p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                disabled={createProjectMutation.isPending}
                className="btn-primary flex-1"
              >
                {createProjectMutation.isPending
                  ? 'Saving...'
                  : isEditing
                  ? 'Update Project'
                  : 'Create Project'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="btn-secondary flex-1"
                disabled={createProjectMutation.isPending}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
