import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CreateProjectDto,
  ProjectResponse,
  CreateProjectSchema,
  PROJECT_COLORS,
  TaskStatus,
} from '@smart-task/contracts';
import { projectApi } from '@/api/projects';
import { taskApi } from '@/api/tasks';
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
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [initializedSelection, setInitializedSelection] = useState(false);

  const [formData, setFormData] = useState<CreateProjectDto>({
    name: project?.name || '',
    description: project?.description || '',
    color: project?.color || PROJECT_COLORS[0],
    deadline: project?.deadline ? new Date(project.deadline).toISOString().split('T')[0] : undefined,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const { data: allTasks = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => taskApi.getTasks(),
  });

  const createProjectMutation = useMutation({
    mutationFn: isEditing
      ? (data: CreateProjectDto) => projectApi.updateProject(project!.id, data)
      : projectApi.createProject,
  });

  const availableTasks = useMemo(() => {
    if (!formData.deadline) {
      return [];
    }

    const projectDeadlineEndOfDay = new Date(`${formData.deadline}T23:59:59.999`);
    return allTasks.filter((taskItem) => {
      if (taskItem.isRecurring) return false;
      if (taskItem.status === TaskStatus.COMPLETED) return false;
      if (!taskItem.deadline) return false;
      if (taskItem.projectId && taskItem.projectId !== project?.id) return false;
      return new Date(taskItem.deadline) <= projectDeadlineEndOfDay;
    });
  }, [allTasks, formData.deadline, project?.id]);

  useEffect(() => {
    if (!isEditing || !project || initializedSelection) {
      return;
    }
    const projectTaskIds = allTasks
      .filter((taskItem) => taskItem.projectId === project.id && !taskItem.isRecurring)
      .map((taskItem) => taskItem.id);
    setSelectedTaskIds(projectTaskIds);
    setInitializedSelection(true);
  }, [allTasks, isEditing, project, initializedSelection]);

  useEffect(() => {
    const validIds = new Set(availableTasks.map((taskItem) => taskItem.id));
    setSelectedTaskIds((prev) => prev.filter((id) => validIds.has(id)));
  }, [availableTasks]);

  const handleSubmit = async (e: React.FormEvent) => {
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

    try {
      const savedProject = await createProjectMutation.mutateAsync(formData);

      const existingProjectTaskIds = isEditing
        ? allTasks
            .filter((taskItem) => taskItem.projectId === project!.id)
            .map((taskItem) => taskItem.id)
        : [];

      const toAssign = selectedTaskIds.filter((id) => !existingProjectTaskIds.includes(id));
      const toUnassign = existingProjectTaskIds.filter((id) => !selectedTaskIds.includes(id));

      if (toAssign.length > 0 || toUnassign.length > 0) {
        await Promise.all([
          ...toAssign.map((taskId) => taskApi.updateTask(taskId, { projectId: savedProject.id })),
          ...toUnassign.map((taskId) => taskApi.updateTask(taskId, { projectId: '' })),
        ]);
      }

      queryClient.refetchQueries({ queryKey: ['projects'] });
      queryClient.refetchQueries({ queryKey: ['tasks'] });
      toast.success(isEditing ? 'Project updated successfully!' : 'Project created successfully!');
      onSuccess?.();
      onClose();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
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

            {/* Task Assignment */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Tasks In Project (optional)
              </label>
              {!formData.deadline && (
                <p className="text-xs text-gray-500">
                  Set a project deadline first. Only non-recurring tasks with deadlines on/before the project deadline are shown.
                </p>
              )}
              {formData.deadline && (
                <>
                  <select
                    multiple
                    value={selectedTaskIds}
                    onChange={(e) => {
                      const selectedOptions = Array.from(e.target.selectedOptions, (option) => option.value);
                      setSelectedTaskIds(selectedOptions);
                    }}
                    className="input min-h-[120px]"
                    style={{ height: 'auto' }}
                  >
                    {availableTasks.map((taskItem) => (
                      <option key={taskItem.id} value={taskItem.id}>
                        {taskItem.title} - {new Date(taskItem.deadline!).toLocaleString()}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Hold Ctrl/Cmd to select multiple tasks. Recurring tasks are excluded.
                  </p>
                </>
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
