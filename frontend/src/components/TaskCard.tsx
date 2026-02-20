import React from 'react';
import { format } from 'date-fns';
import { TaskResponse, Priority, TaskStatus, TaskType } from '@smart-task/contracts';

interface TaskCardProps {
  task: TaskResponse;
  onEdit: (task: TaskResponse) => void;
  onDelete: (taskId: string) => void;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({
  task,
  onEdit,
  onDelete,
  onStatusChange,
}) => {
  const getPriorityColor = (priority: Priority) => {
    switch (priority) {
      case Priority.HIGH:
        return 'bg-red-100 text-red-800 border-red-200';
      case Priority.MEDIUM:
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case Priority.LOW:
        return 'bg-green-100 text-green-800 border-green-200';
    }
  };

  const getStatusColor = (status: TaskStatus) => {
    switch (status) {
      case TaskStatus.COMPLETED:
        return 'bg-green-100 text-green-800';
      case TaskStatus.IN_PROGRESS:
        return 'bg-purple-100 text-purple-800';
      case TaskStatus.PENDING:
        return 'bg-blue-100 text-blue-800';
    }
  };

  const formatDateTime = (dateString: string) => {
    return format(new Date(dateString), 'MMM dd, yyyy h:mm a');
  };

  const isOverdue = task.deadline && new Date(task.deadline) < new Date();
  const isReminderOverdue = task.type === TaskType.REMINDER && new Date(task.startDateTime) < new Date();
  const isDurationTask = task.type === TaskType.DURATION;
  const isReminderTask = task.type === TaskType.REMINDER;

  return (
    <div
      className={`card hover:shadow-lg transition-shadow border-l-4 ${
        task.priority === Priority.HIGH
          ? 'border-l-red-500'
          : task.priority === Priority.MEDIUM
          ? 'border-l-yellow-500'
          : 'border-l-green-500'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900">{task.title}</h3>
          <div className="flex gap-2 mt-2 flex-wrap">
            <span
              className={`badge ${getPriorityColor(task.priority)} border`}
            >
              {task.priority.toUpperCase()}
            </span>
            <span className="badge bg-gray-100 text-gray-700">
              {task.type === TaskType.REMINDER ? '⏰ Event' : '📋 Project'}
            </span>
            <span className={`badge ${getStatusColor(task.status || TaskStatus.PENDING)}`}>
              {(task.status || TaskStatus.PENDING).replace('-', ' ').toUpperCase()}
            </span>
            {task.reminderEnabled && (
              <span className="badge bg-blue-100 text-blue-700">🔔 Reminders On</span>
            )}
          </div>
        </div>
      </div>

      {/* Time Info */}
      <div className="space-y-2 mb-4 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-gray-600 font-medium">
            {isReminderTask ? 'Scheduled:' : 'Start:'}
          </span>
          <span
            className={`${
              isReminderOverdue && task.status !== TaskStatus.COMPLETED
                ? 'text-red-600 font-semibold'
                : 'text-gray-900'
            }`}
          >
            {formatDateTime(task.startDateTime)}
            {isReminderOverdue && task.status !== TaskStatus.COMPLETED && ' (OVERDUE!)'}
          </span>
        </div>
        {task.deadline && (
          <div className="flex items-center gap-2">
            <span className="text-gray-600 font-medium">Deadline:</span>
            <span
              className={`${
                isOverdue && task.status !== TaskStatus.COMPLETED
                  ? 'text-red-600 font-semibold'
                  : 'text-gray-900'
              }`}
            >
              {formatDateTime(task.deadline)}
              {isOverdue && task.status !== TaskStatus.COMPLETED && ' (OVERDUE!)'}
            </span>
          </div>
        )}
      </div>

      {/* Status Change (for duration tasks) */}
      {isDurationTask && task.status !== TaskStatus.COMPLETED && (
        <div className="mb-4">
          <label className="text-xs text-gray-600 mb-1 block">Update Status:</label>
          <div className="flex gap-2">
            <button
              onClick={() => onStatusChange(task.id, TaskStatus.PENDING)}
              className={`text-xs px-3 py-1 rounded ${
                task.status === TaskStatus.PENDING
                  ? 'bg-blue-200 text-blue-800'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Pending
            </button>
            <button
              onClick={() => onStatusChange(task.id, TaskStatus.IN_PROGRESS)}
              className={`text-xs px-3 py-1 rounded ${
                task.status === TaskStatus.IN_PROGRESS
                  ? 'bg-purple-200 text-purple-800'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              In Progress
            </button>
            <button
              onClick={() => onStatusChange(task.id, TaskStatus.COMPLETED)}
              className={`text-xs px-3 py-1 rounded bg-green-100 text-green-700 hover:bg-green-200`}
            >
              Complete
            </button>
          </div>
        </div>
      )}

      {/* Mark Complete (for reminder tasks) */}
      {isReminderTask && task.status !== TaskStatus.COMPLETED && (
        <div className="mb-4">
          <button
            onClick={() => onStatusChange(task.id, TaskStatus.COMPLETED)}
            className="w-full text-sm px-4 py-2 rounded bg-green-500 text-white hover:bg-green-600 transition-colors font-medium"
          >
            ✓ Mark as Complete
          </button>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-3 border-t">
        <button
          onClick={() => onEdit(task)}
          className="text-sm text-primary-600 hover:underline"
        >
          Edit
        </button>
        <button
          onClick={() => onDelete(task.id)}
          className="text-sm text-red-600 hover:underline"
        >
          Delete
        </button>
      </div>
    </div>
  );
};
