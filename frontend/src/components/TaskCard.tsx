import React from 'react';
import { format } from 'date-fns';
import { TaskResponse, Priority, TaskStatus, TaskType } from '@smart-task/contracts';
import { calculateCurrentOccurrence, formatRecurrenceText } from '@/utils/recurrence';
import { useQuery } from '@tanstack/react-query';
import { taskApi } from '@/api/tasks';
import { projectApi } from '@/api/projects';

interface TaskCardProps {
  task: TaskResponse;
  onEdit: (task: TaskResponse) => void;
  onDelete: (taskId: string) => void;
  onStatusChange: (taskId: string, status: TaskStatus) => void;
  isUpdating?: boolean;
}

const TaskCardComponent: React.FC<TaskCardProps> = ({
  task,
  onEdit,
  onDelete,
  onStatusChange,
  isUpdating = false,
}) => {
  // Fetch all tasks to show subtask details
  const { data: allTasks = [] } = useQuery({
    queryKey: ['tasks'],
    queryFn: () => taskApi.getTasks(),
  });

  // Fetch all projects to show project info
  const { data: allProjects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectApi.getProjects(),
  });

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

  // For recurring tasks, calculate the current occurrence
  const currentOccurrence = task.isRecurring 
    ? calculateCurrentOccurrence(task)
    : null;

  // Determine dates to display (current occurrence for recurring, actual dates for one-time)
  const displayStartDate = currentOccurrence 
    ? currentOccurrence.currentDate 
    : new Date(task.startDateTime);
  
  const isOverdue = task.deadline && new Date(task.deadline) < new Date();
  const isReminderOverdue = currentOccurrence 
    ? currentOccurrence.isOverdue && !currentOccurrence.isCompleted
    : (task.type === TaskType.REMINDER && new Date(task.startDateTime) < new Date());
  const isDurationTask = task.type === TaskType.DURATION;
  const isReminderTask = task.type === TaskType.REMINDER;
  const isRecurringCompleted = currentOccurrence?.isCompleted || false;
  
  // Check if task has incomplete subtasks (prevent completion)
  const hasIncompleteSubtasks = task.subtasks && task.subtasks.length > 0 && task.progress !== 100;

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
            {task.projectId && (() => {
              const project = allProjects.find(p => p.id === task.projectId);
              return project ? (
                <span 
                  className="badge text-xs"
                  style={{ 
                    backgroundColor: `${project.color}20`,
                    color: project.color,
                    borderColor: project.color,
                    borderWidth: '1px'
                  }}
                >
                  📁 {project.name}
                </span>
              ) : null;
            })()}
            {task.isRecurring && !isRecurringCompleted && task.recurrencePattern && (
              <span className="badge bg-purple-100 text-purple-700">
                {task.recurrencePattern.endDate
                  ? `🔄 Until ${format(new Date(task.recurrencePattern.endDate), 'MMM dd')}`
                  : task.recurrencePattern.occurrences
                  ? `🔄 ${task.recurrencePattern.occurrences} left`
                  : '🔄 Recurring'}
              </span>
            )}
            {isRecurringCompleted && (
              <span className="badge bg-gray-100 text-gray-600">
                ✓ Series Complete
              </span>
            )}
            {task.isBlocked && !isRecurringCompleted && (
              <span className="badge bg-red-100 text-red-700 border border-red-300">
                🔒 Blocked by {task.blockedBy?.length || 0} task{task.blockedBy?.length !== 1 ? 's' : ''}
              </span>
            )}
            {!isRecurringCompleted && (
              <span className={`badge ${getStatusColor(task.status || TaskStatus.PENDING)}`}>
                {(task.status || TaskStatus.PENDING).replace('-', ' ').toUpperCase()}
              </span>
            )}
            {task.reminderEnabled && (
              <span className="badge bg-blue-100 text-blue-700">🔔 Reminders On</span>
            )}
          </div>
        </div>
      </div>

      {/* Time Info */}
      <div className="space-y-2 mb-4 text-sm">
        {task.isRecurring && task.recurrencePattern && (
          <div className="text-purple-700 text-xs font-medium mb-2">
            {formatRecurrenceText(task.recurrencePattern)}
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="text-gray-600 font-medium">
            {task.isRecurring ? 'Current:' : isReminderTask ? 'Scheduled:' : 'Start:'}
          </span>
          <span
            className={`${
              isReminderOverdue && task.status !== TaskStatus.COMPLETED && !isRecurringCompleted
                ? 'text-red-600 font-semibold'
                : 'text-gray-900'
            }`}
          >
            {formatDateTime(displayStartDate.toISOString())}
            {isReminderOverdue && task.status !== TaskStatus.COMPLETED && !isRecurringCompleted && ' (OVERDUE!)'}
          </span>
        </div>
        {task.deadline && !task.isRecurring && (
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

      {/* Dependencies Info */}
      {task.dependsOn && task.dependsOn.length > 0 && (
        <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <div className="text-xs font-semibold text-blue-800 mb-2">
            🔗 Dependencies ({task.dependsOn.length})
          </div>
          {task.isBlocked ? (
            <div className="text-xs text-red-700">
              ⚠️ This task is blocked. Complete the following tasks first:
              <div className="mt-1 text-red-600 font-medium">
                {task.blockedBy?.length} incomplete {task.blockedBy?.length === 1 ? 'dependency' : 'dependencies'}
              </div>
            </div>
          ) : (
            <div className="text-xs text-green-700">
              ✅ All dependencies completed. Task is ready to start!
            </div>
          )}
        </div>
      )}

      {/* Subtasks Info */}
      {task.subtasks && task.subtasks.length > 0 && (
        <div className="mb-4 p-3 bg-purple-50 rounded-lg border border-purple-200">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-semibold text-purple-800">
              📋 Subtasks ({task.subtasks.length})
            </div>
            {task.progress !== undefined && (
              <div className="text-xs font-semibold text-purple-800">
                {task.progress}%
              </div>
            )}
          </div>
          
          {/* Progress Bar */}
          {task.progress !== undefined && (
            <div className="mb-3 bg-purple-200 rounded-full h-2 overflow-hidden">
              <div 
                className="bg-purple-600 h-full transition-all duration-300"
                style={{ width: `${task.progress}%` }}
              />
            </div>
          )}
          
          {/* Subtask List */}
          <div className="space-y-1">
            {task.subtasks.map(subtaskId => {
              const subtask = allTasks.find(t => t.id === subtaskId);
              if (!subtask) return null;
              
              return (
                <div 
                  key={subtaskId} 
                  className="flex items-center gap-2 text-xs p-2 bg-white rounded border border-purple-100"
                >
                  <span className="text-sm">
                    {subtask.status === TaskStatus.COMPLETED ? '✅' : '⬜'}
                  </span>
                  <span className={`flex-1 ${subtask.status === TaskStatus.COMPLETED ? 'line-through text-gray-500' : 'text-gray-700'}`}>
                    {subtask.title}
                  </span>
                  <span className={`badge text-[10px] px-1.5 py-0.5 ${
                    subtask.status === TaskStatus.COMPLETED
                      ? 'bg-green-100 text-green-700'
                      : subtask.status === TaskStatus.IN_PROGRESS
                      ? 'bg-purple-100 text-purple-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {subtask.status?.replace('-', ' ') || 'pending'}
                  </span>
                </div>
              );
            })}
          </div>
          
          {task.progress === 100 && (
            <div className="mt-2 text-xs text-green-700 text-center font-medium">
              🎉 All subtasks completed!
            </div>
          )}
        </div>
      )}

      {/* Status Change (for duration tasks) */}
      {isDurationTask && task.status !== TaskStatus.COMPLETED && !isRecurringCompleted && (
        <div className="mb-4">
          <label className="text-xs text-gray-600 mb-1 block">Update Status:</label>
          <div className="flex gap-2">
            <button
              onClick={() => onStatusChange(task.id, TaskStatus.PENDING)}
              disabled={isUpdating}
              className={`text-xs px-3 py-1 rounded ${
                task.status === TaskStatus.PENDING
                  ? 'bg-blue-200 text-blue-800'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              Pending
            </button>
            <button
              onClick={() => onStatusChange(task.id, TaskStatus.IN_PROGRESS)}
              disabled={isUpdating || task.isBlocked}
              className={`text-xs px-3 py-1 rounded ${
                task.status === TaskStatus.IN_PROGRESS
                  ? 'bg-purple-200 text-purple-800'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
              title={task.isBlocked ? 'Task is blocked by incomplete dependencies' : ''}
            >
              In Progress
            </button>
            <button
              onClick={() => onStatusChange(task.id, TaskStatus.COMPLETED)}
              disabled={isUpdating || task.isBlocked || hasIncompleteSubtasks}
              className={`text-xs px-3 py-1 rounded bg-green-100 text-green-700 hover:bg-green-200 disabled:opacity-50 disabled:cursor-not-allowed`}
              title={
                task.isBlocked 
                  ? 'Task is blocked by incomplete dependencies' 
                  : hasIncompleteSubtasks
                  ? 'Complete all subtasks first'
                  : ''
              }
            >
              Complete
            </button>
          </div>
        </div>
      )}

      {/* Mark Complete (for reminder tasks) */}
      {isReminderTask && task.status !== TaskStatus.COMPLETED && !isRecurringCompleted && (
        <div className="mb-4">
          <button
            onClick={() => onStatusChange(task.id, TaskStatus.COMPLETED)}
            disabled={isUpdating || task.isBlocked || hasIncompleteSubtasks}
            className="w-full text-sm px-4 py-2 rounded bg-green-500 text-white hover:bg-green-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            title={
              task.isBlocked 
                ? 'Task is blocked by incomplete dependencies' 
                : hasIncompleteSubtasks
                ? 'Complete all subtasks first'
                : ''
            }
          >
            {isUpdating ? 'Updating...' : `✓ Mark as Complete${task.isRecurring ? ' (Current Occurrence)' : ''}`}
          </button>
          {task.isBlocked && (
            <p className="text-xs text-red-600 mt-1 text-center">
              ⚠️ Complete dependencies first
            </p>
          )}
          {hasIncompleteSubtasks && (
            <p className="text-xs text-red-600 mt-1 text-center">
              ⚠️ Complete all subtasks first ({task.progress}% done)
            </p>
          )}
        </div>
      )}

      {/* Recurring series completed message */}
      {isRecurringCompleted && (
        <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded text-center">
          <span className="text-sm text-gray-600">
            ✓ All occurrences completed
          </span>
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

// Memoize to prevent unnecessary re-renders when other tasks change
export const TaskCard = React.memo(TaskCardComponent, (prevProps, nextProps) => {
  // Only re-render if something actually changed for THIS task
  const taskChanged = 
    prevProps.task.id !== nextProps.task.id ||
    prevProps.task.status !== nextProps.task.status ||
    prevProps.task.startDateTime !== nextProps.task.startDateTime ||
    prevProps.task.deadline !== nextProps.task.deadline ||
    prevProps.task.title !== nextProps.task.title ||
    prevProps.task.priority !== nextProps.task.priority ||
    prevProps.task.reminderEnabled !== nextProps.task.reminderEnabled ||
    prevProps.task.updatedAt !== nextProps.task.updatedAt ||
    prevProps.task.progress !== nextProps.task.progress ||
    prevProps.task.parentTaskId !== nextProps.task.parentTaskId ||
    JSON.stringify(prevProps.task.subtasks) !== JSON.stringify(nextProps.task.subtasks) ||
    JSON.stringify(prevProps.task.recurrencePattern) !== JSON.stringify(nextProps.task.recurrencePattern);
  
  const updatingChanged = prevProps.isUpdating !== nextProps.isUpdating;
  
  // Return true to SKIP re-render (props are equal), false to re-render
  return !taskChanged && !updatingChanged;
});
