import React, { useEffect, useMemo, useState } from 'react';
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
import { projectApi } from '@/api/projects';
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
  
  // Fetch all projects for project selection
  const { data: allProjects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectApi.getProjects(),
  });
  const [showRecurrence, setShowRecurrence] = useState(task?.isRecurring || false);
  const [recurrenceEndType, setRecurrenceEndType] = useState<'never' | 'date' | 'occurrences'>('never');

  // Get current date/time for min attribute (format: YYYY-MM-DDTHH:MM)
  const now = new Date();
  const minDateTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);

  // Helper to convert ISO string to datetime-local format
  const formatDateTimeLocal = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };
  const toDateTimeLocal = (isoString: string) => formatDateTimeLocal(new Date(isoString));
  const parseProjectDeadlineEndOfDay = (deadlineIsoOrDate: string): Date => {
    const datePart = deadlineIsoOrDate.slice(0, 10);
    const [year, month, day] = datePart.split('-').map(Number);
    return new Date(year, month - 1, day, 23, 59, 59, 999);
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
    parentTaskId: task?.parentTaskId,
    projectId: task?.projectId,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const nonRecurringTasks = useMemo(
    () => allTasks.filter((t) => t.id !== task?.id && !t.isRecurring),
    [allTasks, task?.id]
  );

  const dependencyOptions = useMemo(
    () => nonRecurringTasks.filter((t) => t.status !== TaskStatus.COMPLETED),
    [nonRecurringTasks]
  );

  const parentOptions = useMemo(
    () =>
      nonRecurringTasks.filter(
        (t) => !t.parentTaskId && t.status !== TaskStatus.COMPLETED && !!t.deadline
      ),
    [nonRecurringTasks]
  );

  const selectedDependencies = useMemo(
    () =>
      (formData.dependsOn || [])
        .map((depId) => allTasks.find((t) => t.id === depId))
        .filter((t): t is TaskResponse => !!t),
    [formData.dependsOn, allTasks]
  );

  const selectedParentTask = useMemo(
    () => allTasks.find((t) => t.id === formData.parentTaskId),
    [allTasks, formData.parentTaskId]
  );
  const selectedProject = useMemo(
    () => allProjects.find((p) => p.id === formData.projectId),
    [allProjects, formData.projectId]
  );

  const getTaskEndDate = (taskItem: TaskResponse): Date => {
    return new Date(taskItem.deadline || taskItem.startDateTime);
  };

  const maxDependencyEnd = useMemo(() => {
    if (selectedDependencies.length === 0) {
      return undefined;
    }
    return selectedDependencies.reduce((max, current) => {
      const currentEnd = getTaskEndDate(current);
      return currentEnd > max ? currentEnd : max;
    }, getTaskEndDate(selectedDependencies[0]));
  }, [selectedDependencies]);

  const maxDate = (a: Date, b: Date): Date => (a > b ? a : b);
  const minDate = (a: Date, b: Date): Date => (a < b ? a : b);
  const toLocalDateTime = (date: Date): string => formatDateTimeLocal(date);

  const dependencyMinDateTime = maxDependencyEnd ? toLocalDateTime(maxDependencyEnd) : undefined;
  const parentDeadlineMax = selectedParentTask?.deadline
    ? new Date(selectedParentTask.deadline)
    : undefined;
  const projectDeadlineMax = selectedProject?.deadline
    ? parseProjectDeadlineEndOfDay(selectedProject.deadline)
    : undefined;
  const taskDeadlineMax = (() => {
    if (parentDeadlineMax && projectDeadlineMax) {
      return minDate(parentDeadlineMax, projectDeadlineMax);
    }
    return parentDeadlineMax || projectDeadlineMax;
  })();
  const taskStartMax = taskDeadlineMax;
  const taskStartMaxDateTime = taskStartMax ? toLocalDateTime(taskStartMax) : undefined;
  const taskDeadlineMaxDateTime = taskDeadlineMax ? toLocalDateTime(taskDeadlineMax) : undefined;

  useEffect(() => {
    setFormData((prev) => {
      let nextStart = prev.startDateTime;
      let nextDeadline = prev.deadline;

      if (maxDependencyEnd) {
        if (!nextStart || new Date(nextStart) < maxDependencyEnd) {
          nextStart = toLocalDateTime(maxDependencyEnd);
        }
        if (nextDeadline && new Date(nextDeadline) < maxDependencyEnd) {
          nextDeadline = toLocalDateTime(maxDependencyEnd);
        }
      }

      if (taskStartMax && nextStart && new Date(nextStart) > taskStartMax) {
        nextStart = toLocalDateTime(taskStartMax);
      }

      if (taskDeadlineMax && nextDeadline) {
        if (new Date(nextDeadline) > taskDeadlineMax) {
          nextDeadline = toLocalDateTime(taskDeadlineMax);
        }
      }

      if (nextStart && nextDeadline && new Date(nextDeadline) < new Date(nextStart)) {
        nextDeadline = nextStart;
      }

      if (nextStart === prev.startDateTime && nextDeadline === prev.deadline) {
        return prev;
      }

      return {
        ...prev,
        startDateTime: nextStart,
        deadline: nextDeadline,
      };
    });
  }, [maxDependencyEnd, taskStartMax, taskDeadlineMax]);

  const createTaskMutation = useMutation({
    mutationFn: isEditing 
      ? (data: CreateTaskDto) => taskApi.updateTask(task!.id, data)
      : taskApi.createTask,
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['tasks'] });
      queryClient.refetchQueries({ queryKey: ['projects'] });
      queryClient.refetchQueries({ queryKey: ['workload', 'current-week'] });
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

    let nextValue: string | boolean = type === 'checkbox' ? checked : value;
    if (typeof nextValue === 'string' && (name === 'startDateTime' || name === 'deadline')) {
      const asDate = new Date(nextValue);

      if (name === 'startDateTime') {
        if (taskStartMax && asDate > taskStartMax) {
          nextValue = toLocalDateTime(taskStartMax);
        } else if (maxDependencyEnd && asDate < maxDependencyEnd) {
          nextValue = toLocalDateTime(maxDependencyEnd);
        }
      }

      if (name === 'deadline') {
        if (taskDeadlineMax && asDate > taskDeadlineMax) {
          nextValue = toLocalDateTime(taskDeadlineMax);
        } else if (maxDependencyEnd && asDate < maxDependencyEnd) {
          nextValue = toLocalDateTime(maxDependencyEnd);
        }
      }
    }

    setFormData({
      ...formData,
      [name]: nextValue,
    });

    if (errors[name]) {
      setErrors({ ...errors, [name]: '' });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const validationErrors: Record<string, string> = {};
    if (taskStartMax && formData.startDateTime) {
      if (new Date(formData.startDateTime) > taskStartMax) {
        validationErrors.startDateTime =
          'Start must be before or equal to the selected project/parent deadline.';
      }
    }
    if (maxDependencyEnd) {
      if (!formData.startDateTime || new Date(formData.startDateTime) < maxDependencyEnd) {
        validationErrors.startDateTime =
          'Start must be after all selected dependency tasks finish.';
      }
      if (formData.deadline && new Date(formData.deadline) < maxDependencyEnd) {
        validationErrors.deadline =
          'Deadline must be after all selected dependency tasks finish.';
      }
    }
    if (parentDeadlineMax && formData.deadline) {
      if (new Date(formData.deadline) > parentDeadlineMax) {
        validationErrors.deadline =
          'Subtask deadline must be before or equal to the selected parent task deadline.';
      }
    }
    if (projectDeadlineMax && formData.deadline) {
      if (new Date(formData.deadline) > projectDeadlineMax) {
        validationErrors.deadline =
          'Task deadline must be before or equal to the selected project deadline.';
      }
    }
    if (maxDependencyEnd && taskStartMax && maxDependencyEnd > taskStartMax) {
      validationErrors.startDateTime =
        'Selected dependencies finish after the selected project/parent deadline. Adjust your selections.';
    }
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

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

            {/* Project Assignment */}
            <div>
              <label className="block text-sm font-medium mb-1">
                📁 Project (optional)
              </label>
              <select
                value={formData.projectId || ''}
                onChange={(e) => {
                  setFormData({ ...formData, projectId: e.target.value || undefined });
                }}
                className="input"
              >
                <option value="">None - No project</option>
                {allProjects.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Assign this task to a project for better organization.
              </p>
              {formData.projectId && (
                <div className="mt-2">
                  {(() => {
                    const project = allProjects.find(p => p.id === formData.projectId);
                    return project ? (
                      <span 
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded"
                        style={{ 
                          backgroundColor: `${project.color}20`,
                          color: project.color,
                          borderColor: project.color,
                          borderWidth: '1px'
                        }}
                      >
                        {project.name}
                        <button
                          type="button"
                          onClick={() => {
                            setFormData({ ...formData, projectId: undefined });
                          }}
                          className="hover:opacity-70"
                        >
                          ×
                        </button>
                      </span>
                    ) : null;
                  })()}
                </div>
              )}
            </div>

            {/* Parent Task (for creating subtasks) */}
            <div>
              <label className="block text-sm font-medium mb-1">
                📂 Parent Task (optional)
              </label>
              <select
                value={formData.parentTaskId || ''}
                onChange={(e) => {
                  setFormData({ ...formData, parentTaskId: e.target.value || undefined });
                }}
                className="input"
              >
                <option value="">None - Top-level task</option>
                {parentOptions.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title} ({t.priority})
                    </option>
                  ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Make this a subtask of another task. Progress will be tracked on the parent.
              </p>
              {formData.parentTaskId && (
                <div className="mt-2">
                  {(() => {
                    const parentTask = allTasks.find(t => t.id === formData.parentTaskId);
                    return parentTask ? (
                      <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">
                        Parent: {parentTask.title}
                        <button
                          type="button"
                          onClick={() => {
                            setFormData({ ...formData, parentTaskId: undefined });
                          }}
                          className="hover:text-purple-900"
                        >
                          ×
                        </button>
                      </span>
                    ) : null;
                  })()}
                </div>
              )}
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
                {dependencyOptions.map((t) => (
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
                min={
                  dependencyMinDateTime
                    ? toLocalDateTime(maxDate(new Date(minDateTime), new Date(dependencyMinDateTime)))
                    : minDateTime
                }
                max={taskStartMaxDateTime}
                className={`input ${errors.startDateTime ? 'border-red-500' : ''}`}
              />
              {errors.startDateTime && (
                <p className="text-red-500 text-sm mt-1">{errors.startDateTime}</p>
              )}
              {taskStartMax && (
                <p className="text-xs text-gray-500 mt-1">
                  Must be before or equal to: {taskStartMax.toLocaleString()}
                </p>
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
                    min={(() => {
                      const currentMin = formData.startDateTime
                        ? new Date(formData.startDateTime)
                        : new Date(minDateTime);
                      const dependencyMin = dependencyMinDateTime
                        ? new Date(dependencyMinDateTime)
                        : currentMin;
                      return toLocalDateTime(maxDate(currentMin, dependencyMin));
                    })()}
                    max={taskDeadlineMaxDateTime}
                    className={`input ${errors.deadline ? 'border-red-500' : ''}`}
                  />
                  {errors.deadline && (
                    <p className="text-red-500 text-sm mt-1">{errors.deadline}</p>
                  )}
                  {selectedParentTask?.deadline && (
                    <p className="text-xs text-gray-500 mt-1">
                      Must be before or equal to parent deadline:{' '}
                      {parentDeadlineMax?.toLocaleString()}
                    </p>
                  )}
                  {selectedProject?.deadline && (
                    <p className="text-xs text-gray-500 mt-1">
                      Must be before or equal to project deadline:{' '}
                      {projectDeadlineMax?.toLocaleString()}
                    </p>
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
