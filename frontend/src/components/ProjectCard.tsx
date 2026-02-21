import React from 'react';
import { format } from 'date-fns';
import { ProjectResponse } from '@smart-task/contracts';

interface ProjectCardProps {
  project: ProjectResponse;
  onEdit: (project: ProjectResponse) => void;
  onDelete: (projectId: string) => void;
  onClick?: (projectId: string) => void;
}

export const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  onEdit,
  onDelete,
  onClick,
}) => {
  const isOverdue = project.deadline && new Date(project.deadline) < new Date() && project.progress !== 100;

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't trigger onClick if clicking on action buttons
    if ((e.target as HTMLElement).closest('button')) {
      return;
    }
    onClick?.(project.id);
  };

  return (
    <div
      className={`card-glass hover:shadow-glass-lg transition-all duration-300 hover:scale-[1.02] border-l-4 ${
        onClick ? 'cursor-pointer' : ''
      }`}
      style={{ borderColor: project.color }}
      onClick={handleCardClick}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <div
              className="w-4 h-4 rounded-full shadow-md"
              style={{ backgroundColor: project.color }}
            />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{project.name}</h3>
          </div>
          {project.description && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{project.description}</p>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400 mb-1">
          <span>Progress</span>
          <span className="font-semibold">{project.progress}%</span>
        </div>
        <div className="bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
          <div
            className="h-full transition-all duration-300"
            style={{
              width: `${project.progress}%`,
              backgroundColor: project.color,
            }}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded p-2">
          <div className="text-xs text-gray-500 dark:text-gray-400">Tasks</div>
          <div className="text-lg font-semibold text-gray-900 dark:text-white">{project.taskCount || 0}</div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-700/50 rounded p-2">
          <div className="text-xs text-gray-500 dark:text-gray-400">Completed</div>
          <div className="text-lg font-semibold text-green-600 dark:text-green-400">{project.completedTaskCount || 0}</div>
        </div>
      </div>

      {/* Deadline */}
      {project.deadline && (
        <div className="mb-4 text-sm">
          <span className="text-gray-600 dark:text-gray-400">Deadline: </span>
          <span
            className={`font-medium ${
              isOverdue ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'
            }`}
          >
            {format(new Date(project.deadline), 'MMM dd, yyyy')}
            {isOverdue && ' (OVERDUE!)'}
          </span>
        </div>
      )}

      {/* Status Badge */}
      <div className="mb-4">
        {project.progress === 100 ? (
          <span className="badge bg-accent-100 dark:bg-accent-900/30 text-accent-800 dark:text-accent-300 border border-accent-300 dark:border-accent-700">
            ✓ Complete
          </span>
        ) : (project.progress || 0) > 0 ? (
          <span className="badge bg-primary-100 dark:bg-primary-900/30 text-primary-800 dark:text-primary-300 border border-primary-300 dark:border-primary-700">
            🔄 In Progress
          </span>
        ) : (
          <span className="badge bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300 border border-gray-300 dark:border-gray-600">
            ⏳ Not Started
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit(project);
          }}
          className="text-sm text-primary-600 dark:text-primary-400 hover:underline"
        >
          Edit
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (confirm(`Delete "${project.name}"? This will not delete the tasks.`)) {
              onDelete(project.id);
            }
          }}
          className="text-sm text-red-600 dark:text-red-400 hover:underline"
        >
          Delete
        </button>
      </div>
    </div>
  );
};
