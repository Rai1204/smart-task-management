import React, { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import {
  CreateTaskDto,
  TaskType,
  Priority,
  TaskStatus,
  CreateTaskSchema,
  ConflictCheckResponse,
  TaskResponse,
  RecurrenceFrequency,

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

  // Fetch all tasks for dependency selection
  const { data: allTasks = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => taskApi.getTasks(),
  });
  const [showRecurrence, setShowRecurrence] = useState(task?.isRecurring || false);
  const [recurrenceEndType, setRecurrenceEndType] = useState<'never' | 'date' | 'occurrences'>('never');

  // Get current date/time for min attribute (format: YYYY-MM-DDTHH:MM)
  const now = new Date();
  const minDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);

  // Helper to convert ISO string to datetime-local format
  const toDateTimeLocal = (isoString: string) => {
    const date = new Date(isoString);
    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return localDate.toISOString().slice(0, 16);
  };

  const [formData, setFormData] = useState<CreateTaskDto>({
    title: task?.title || '',
    type: task?.type || TaskType.REMINDER,
    priority: task?.priority || Priority.MEDIUM,
    startDateTime: task ? toDateTimeLocal(task.startDateTime) : '',
    deadline: task?.deadline ? toDateTimeLocal(task.deadline) : undefined,
    status: task?.status || undefined,
    reminderEnabled: task?.reminderEnabled || false,
    isRecurring: task?.isRecurring || false,
    recurrencePattern: task?.recurrencePattern ? {
      ...task.recurrencePattern,
      endDate: task.recurrencePattern.endDate 
        ? new Date(task.recurrencePattern.endDate).toISOString().split('T')[0]
        : undefined,
    } : undefined,
    dependsOn: task?.dependsOn || [],
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
      // Convert recurrence pattern endDate to ISO string
      recurrencePattern: formData.recurrencePattern && formData.isRecurring
        ? {
            ...formData.recurrencePattern,
            endDate: formData.recurrencePattern.endDate
              ? new Date(formData.recurrencePattern.endDate).toISOString()
              : undefined,
          }
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
      // Convert recurrence pattern endDate to ISO string
      recurrencePattern: formData.recurrencePattern && formData.isRecurring
        ? {
            ...formData.recurrencePattern,
            endDate: formData.recurrencePattern.endDate
              ? new Date(formData.recurrencePattern.endDate).toISOString()
              : undefined,
          }
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

  const handleApplySuggestion = (suggestion: import('@smart-task/contracts').TimeSuggestion) => {
    // Convert ISO strings to datetime-local format
    const startLocal = toDateTimeLocal(suggestion.startDateTime);
    const deadlineLocal = toDateTimeLocal(suggestion.deadline);
    
    setFormData({
      ...formData,
      startDateTime: startLocal,
      deadline: deadlineLocal,
    });
    
    setShowConflictModal(false);
    toast.success('Time adjusted to avoid conflicts!');
  };

  const formatDuration = (ms: number) => {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0 && minutes > 0) {
      return `${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h`;
    } else {
      return `${minutes}m`;
    }
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

            {/* Task Dependencies */}
            <div>
              <label className="block text-sm font-medium mb-1">
                🔗 Depends On (optional)
              </label>
              <select
                multiple
                value={formData.dependsOn || []}
                onChange={(e) => {
                  const selectedOptions = Array.from(e.target.selectedOptions, option => option.value);
                  setFormData({ ...formData, dependsOn: selectedOptions });
                }}
                className="input min-h-[100px]"
                style={{ height: 'auto' }}
              >
                {allTasks
                  .filter(t => t.id !== task?.id) // Exclude current task when editing
                  .filter(t => t.status !== TaskStatus.COMPLETED) // Only show incomplete tasks
                  .map(t => (
                    <option key={t.id} value={t.id}>
                      {t.title} ({t.priority}) - {new Date(t.startDateTime).toLocaleDateString()}
                    </option>
                  ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Hold Ctrl/Cmd to select multiple tasks. This task cannot start until selected tasks are completed.
              </p>
              {formData.dependsOn && formData.dependsOn.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {formData.dependsOn.map(depId => {
                    const depTask = allTasks.find(t => t.id === depId);
                    return depTask ? (
                      <span key={depId} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                        {depTask.title}
                        <button
                          type="button"
                          onClick={() => {
                            setFormData({
                              ...formData,
                              dependsOn: formData.dependsOn?.filter(id => id !== depId)
                            });
                          }}
                          className="hover:text-blue-900"
                        >
                          ×
                        </button>
                      </span>
                    ) : null;
                  })}
                </div>
              )}
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

            {/* Recurrence Section */}
            <div className="border-t pt-4">
              <div className="flex items-center mb-3">
                <input
                  type="checkbox"
                  checked={showRecurrence}
                  onChange={(e) => {
                    setShowRecurrence(e.target.checked);
                    if (!e.target.checked) {
                      setFormData({...formData, isRecurring: false, recurrencePattern: undefined});
                    } else {
                      setFormData({
                        ...formData,
                        isRecurring: true,
                        recurrencePattern: {
                          frequency: RecurrenceFrequency.DAILY,
                          interval: 1,
                        }
                      });
                    }
                  }}
                  className="w-4 h-4 text-primary-600"
                />
                <label className="ml-2 text-sm font-medium">🔄 Repeat this task</label>
              </div>

              {showRecurrence && (
                <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                  {/* Frequency */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium mb-1">Repeat Every</label>
                      <input
                        type="number"
                        min="1"
                        value={formData.recurrencePattern?.interval ||1}
                        onChange={(e) => setFormData({
                          ...formData,
                          recurrencePattern: {
                            ...formData.recurrencePattern!,
                            interval: parseInt(e.target.value) || 1
                          }
                        })}
                        className="input text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">Period</label>
                      <select
                        value={formData.recurrencePattern?.frequency || RecurrenceFrequency.DAILY}
                        onChange={(e) => setFormData({
                          ...formData,
                          recurrencePattern: {
                            ...formData.recurrencePattern!,
                            frequency: e.target.value as RecurrenceFrequency
                          }
                        })}
                        className="input text-sm"
                      >
                        <option value={RecurrenceFrequency.DAILY}>Day(s)</option>
                        <option value={RecurrenceFrequency.WEEKLY}>Week(s)</option>
                        <option value={RecurrenceFrequency.MONTHLY}>Month(s)</option>
                        <option value={RecurrenceFrequency.YEARLY}>Year(s)</option>
                      </select>
                    </div>
                  </div>

                  {/* End Condition */}
                  <div>
                    <label className="block text-xs font-medium mb-2">Ends</label>
                    <div className="space-y-2">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          checked={recurrenceEndType === 'never'}
                          onChange={() => {
                            setRecurrenceEndType('never');
                            setFormData({
                              ...formData,
                              recurrencePattern: {
                                ...formData.recurrencePattern!,
                                endDate: undefined,
                                occurrences: undefined,
                              }
                            });
                          }}
                          className="mr-2"
                        />
                        <span className="text-sm">Never</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          checked={recurrenceEndType === 'date'}
                          onChange={() => {
                            setRecurrenceEndType('date');
                            // Initialize with a default date (7 days from start)
                            const defaultEndDate = formData.startDateTime 
                              ? new Date(new Date(formData.startDateTime).getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
                              : undefined;
                            setFormData({
                              ...formData,
                              recurrencePattern: {
                                ...formData.recurrencePattern!,
                                endDate: defaultEndDate as any,
                                occurrences: undefined,
                              }
                            });
                          }}
                          className="mr-2"
                        />
                        <span className="text-sm">On date</span>
                      </label>
                      {recurrenceEndType === 'date' && (
                        <input
                          type="date"
                          min={formData.startDateTime ? formData.startDateTime.split('T')[0] : undefined}
                          value={
                            formData.recurrencePattern?.endDate 
                              ? String(formData.recurrencePattern.endDate).split('T')[0]
                              : ''
                          }
                          onChange={(e) => setFormData({
                            ...formData,
                            recurrencePattern: {
                              ...formData.recurrencePattern!,
                              endDate: e.target.value as any,
                              occurrences: undefined,
                            }
                          })}
                          className="input text-sm ml-6 w-full"
                        />
                      )}
                      <label className="flex items-center">
                        <input
                          type="radio"
                          checked={recurrenceEndType === 'occurrences'}
                          onChange={() => {
                            setRecurrenceEndType('occurrences');
                            setFormData({
                              ...formData,
                              recurrencePattern: {
                                ...formData.recurrencePattern!,
                                occurrences: 10, // Default to 10 occurrences
                                endDate: undefined,
                              }
                            });
                          }}
                          className="mr-2"
                        />
                        <span className="text-sm">After</span>
                      </label>
                      {recurrenceEndType === 'occurrences' && (
                        <div className="flex items-center ml-6">
                          <input
                            type="number"
                            min="1"
                            max="365"
                            value={formData.recurrencePattern?.occurrences || 10}
                            onChange={(e) => setFormData({
                              ...formData,
                              recurrencePattern: {
                                ...formData.recurrencePattern!,
                                occurrences: parseInt(e.target.value) || 1,
                                endDate: undefined,
                              }
                            })}
                            className="input text-sm w-20"
                          />
                          <span className="ml-2 text-sm">occurrences</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
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
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
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
              {conflicts.taskDuration && (
                <p className="text-xs text-gray-600 mt-1">
                  Task duration: {formatDuration(conflicts.taskDuration)}
                </p>
              )}
            </div>

            {/* Time Suggestions */}
            {conflicts.suggestions && conflicts.suggestions.length > 0 && (
              <div className="mb-4">
                <h4 className="font-semibold text-gray-800 mb-2">
                  💡 Suggested Available Times:
                </h4>
                <div className="space-y-2">
                  {conflicts.suggestions.map((suggestion, index) => (
                    <button
                      key={index}
                      onClick={() => handleApplySuggestion(suggestion)}
                      className="w-full text-left p-3 bg-green-50 border border-green-200 rounded hover:bg-green-100 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-green-800">
                            {new Date(suggestion.startDateTime).toLocaleString('en-US', { 
                              month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true 
                            })} →{' '}
                            {new Date(suggestion.deadline).toLocaleString('en-US', { 
                              hour: 'numeric', minute: '2-digit', hour12: true 
                            })}
                          </p>
                          <p className="text-xs text-green-600 mt-1">
                            {suggestion.reason}
                          </p>
                        </div>
                        <span className="text-green-600 ml-2">→</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={handleConflictReschedule}
                className="btn btn-secondary flex-1"
              >
                Manual Reschedule
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
