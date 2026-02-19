import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CreateTaskDto,
  TaskType,
  Priority,
  TaskStatus,
  CreateTaskSchema,
  ConflictCheckResponse,
  TaskResponse,
} from '@smart-task/contracts';
import { taskApi } from '@/api/tasks';
import { getErrorMessage } from '@/lib/axios';
import toast from 'react-hot-toast';
import axios from 'axios';

interface TaskFormProps {
  task?: TaskResponse | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export const TaskForm: React.FC<TaskFormProps> = ({ task, onClose, onSuccess }) => {
  const isEditing = !!task;
  const queryClient = useQueryClient();
  const [taskType, setTaskType] = useState<TaskType>(task?.type || TaskType.REMINDER);
  const [conflicts, setConflicts] = useState<ConflictCheckResponse | null>(null);
  const [showConflictModal, setShowConflictModal] = useState(false);

  // Get current date/time for min attribute (format: YYYY-MM-DDTHH:MM)
  const now = new Date();
  const minDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);

  // Helper to convert ISO string to datetime-local format
  const toDateTimeLocal = (isoString: string) => {
    return new Date(isoString).toISOString().slice(0, 16);
  };

  const [formData, setFormData] = useState<CreateTaskDto>({
    title: task?.title || '',
    type: task?.type || TaskType.REMINDER,
    priority: task?.priority || Priority.MEDIUM,
    startDateTime: task ? toDateTimeLocal(task.startDateTime) : '',
    deadline: task?.deadline ? toDateTimeLocal(task.deadline) : undefined,
    status: task?.status || undefined,
    reminderEnabled: task?.reminderEnabled || false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const createTaskMutation = useMutation({
    mutationFn: isEditing 
      ? (data: CreateTaskDto) => taskApi.updateTask(task!.id, data)
      : taskApi.createTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success(isEditing ? 'Task updated successfully!' : 'Task created successfully!');
      onSuccess?.();
      onClose();
    },
    onError: (error) => {
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        // Conflict detected
        const conflictData = error.response.data.conflicts as ConflictCheckResponse;
        setConflicts(conflictData);
        setShowConflictModal(true);
      } else {
        toast.error(getErrorMessage(error));
      }
    },
  });

  const handleTypeChange = (type: TaskType) => {
    setTaskType(type);
    setFormData({
      ...formData,
      type,
      deadline: type === TaskType.DURATION ? '' : undefined,
      status: type === TaskType.DURATION ? TaskStatus.PENDING : undefined,
    });
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });

    if (errors[name]) {
      setErrors({ ...errors, [name]: '' });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Convert datetime-local to ISO string
    const dataToSubmit = {
      ...formData,
      startDateTime: formData.startDateTime 
        ? new Date(formData.startDateTime).toISOString() 
        : '',
      deadline: formData.deadline 
        ? new Date(formData.deadline).toISOString() 
        : undefined,
      // When editing, allow override to avoid conflicts with itself
      ...(isEditing && { overrideConflicts: true }),
    };

    // Validate with Zod
    const result = CreateTaskSchema.safeParse(dataToSubmit);
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

    createTaskMutation.mutate(dataToSubmit);
  };

  const handleConflictOverride = () => {
    // Force create despite conflict
    setShowConflictModal(false);
    
    // Convert to ISO strings and add override flag
    const dataToSubmit = {
      ...formData,
      startDateTime: formData.startDateTime 
        ? new Date(formData.startDateTime).toISOString() 
        : '',
      deadline: formData.deadline 
        ? new Date(formData.deadline).toISOString() 
        : undefined,
      overrideConflicts: true,
    };
    
    createTaskMutation.mutate(dataToSubmit);
  };

  const handleConflictReschedule = () => {
    setShowConflictModal(false);
    // User can modify the form
    toast('Please adjust the time to avoid conflicts', { icon: '⏰' });
  };

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <h2 className="text-2xl font-bold mb-4">
            {isEditing ? 'Edit Task' : 'Create New Task'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Task Type Selection */}
            <div>
              <label className="block text-sm font-medium mb-2">Task Type</label>
              <div className="flex gap-4">
                <button
                  type="button"
                  onClick={() => handleTypeChange(TaskType.REMINDER)}
                  className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all ${
                    taskType === TaskType.REMINDER
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-semibold">⏰ Scheduled Event</div>
                  <div className="text-xs text-gray-600 mt-1">
                    Single point in time (meetings, appointments)
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => handleTypeChange(TaskType.DURATION)}
                  className={`flex-1 py-3 px-4 rounded-lg border-2 transition-all ${
                    taskType === TaskType.DURATION
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-semibold">📋 Project Task</div>
                  <div className="text-xs text-gray-600 mt-1">
                    Long-term tasks with deadlines
                  </div>
                </button>
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-sm font-medium mb-1">Title *</label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleChange}
                className={`input ${errors.title ? 'border-red-500' : ''}`}
                placeholder="Enter task title"
              />
              {errors.title && (
                <p className="text-red-500 text-sm mt-1">{errors.title}</p>
              )}
            </div>

            {/* Priority */}
            <div>
              <label className="block text-sm font-medium mb-1">Priority</label>
              <select
                name="priority"
                value={formData.priority}
                onChange={handleChange}
                className="input"
              >
                <option value={Priority.LOW}>Low</option>
                <option value={Priority.MEDIUM}>Medium</option>
                <option value={Priority.HIGH}>High</option>
              </select>
            </div>

            {/* Start Date & Time */}
            <div>
              <label className="block text-sm font-medium mb-1">
                Start Date & Time *
              </label>
              <input
                type="datetime-local"
                name="startDateTime"
                value={formData.startDateTime}
                onChange={handleChange}
                min={minDateTime}
                className={`input ${errors.startDateTime ? 'border-red-500' : ''}`}
              />
              {errors.startDateTime && (
                <p className="text-red-500 text-sm mt-1">{errors.startDateTime}</p>
              )}
            </div>

            {/* Deadline (Duration tasks only) */}
            {taskType === TaskType.DURATION && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1">
                    Deadline *
                  </label>
                  <input
                    type="datetime-local"
                    name="deadline"
                    value={formData.deadline || ''}
                    onChange={handleChange}
                    min={formData.startDateTime || minDateTime}
                    className={`input ${errors.deadline ? 'border-red-500' : ''}`}
                  />
                  {errors.deadline && (
                    <p className="text-red-500 text-sm mt-1">{errors.deadline}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1">Status</label>
                  <select
                    name="status"
                    value={formData.status || TaskStatus.PENDING}
                    onChange={handleChange}
                    className="input"
                  >
                    <option value={TaskStatus.PENDING}>Pending</option>
                    <option value={TaskStatus.IN_PROGRESS}>In Progress</option>
                    <option value={TaskStatus.COMPLETED}>Completed</option>
                  </select>
                </div>
              </>
            )}

            {/* Reminder Toggle */}
            <div className="flex items-center">
              <input
                type="checkbox"
                name="reminderEnabled"
                checked={formData.reminderEnabled}
                onChange={handleChange}
                className="w-4 h-4 text-primary-600"
              />
              <label className="ml-2 text-sm">Enable smart reminders</label>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="btn btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createTaskMutation.isPending}
                className="btn btn-primary flex-1"
              >
                {createTaskMutation.isPending 
                  ? (isEditing ? 'Updating...' : 'Creating...') 
                  : (isEditing ? 'Update Task' : 'Create Task')}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Conflict Modal */}
      {showConflictModal && conflicts && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-red-600 mb-3">
              ⚠️ Scheduling Conflict
            </h3>
            <p className="text-gray-700 mb-4">
              You already have a task scheduled during this time.
            </p>
            <div className="bg-red-50 border border-red-200 rounded p-3 mb-4">
              <p className="text-sm text-red-800">
                {conflicts.conflicts[0]?.message}
              </p>
              <p className="text-xs text-red-600 mt-1">
                Conflicts with {conflicts.conflicts[0]?.conflictsWith.length} task(s)
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleConflictReschedule}
                className="btn btn-secondary flex-1"
              >
                Reschedule
              </button>
              <button
                onClick={handleConflictOverride}
                className="btn bg-orange-600 text-white hover:bg-orange-700 flex-1"
              >
                Continue Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
