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
      className={`card hover:shadow-lg transition-all border-l-4 ${
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
              className="w-4 h-4 rounded-full"
              style={{ backgroundColor: project.color }}
            />
            <h3 className="text-lg font-semibold text-gray-900">{project.name}</h3>
          </div>
          {project.description && (
            <p className="text-sm text-gray-600 mb-3">{project.description}</p>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
          <span>Progress</span>
          <span className="font-semibold">{project.progress}%</span>
        </div>
        <div className="bg-gray-200 rounded-full h-2 overflow-hidden">
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
        <div className="bg-gray-50 rounded p-2">
          <div className="text-xs text-gray-500">Tasks</div>
          <div className="text-lg font-semibold text-gray-900">{project.taskCount || 0}</div>
        </div>
        <div className="bg-gray-50 rounded p-2">
          <div className="text-xs text-gray-500">Completed</div>
          <div className="text-lg font-semibold text-green-600">{project.completedTaskCount || 0}</div>
        </div>
      </div>

      {/* Deadline */}
      {project.deadline && (
        <div className="mb-4 text-sm">
          <span className="text-gray-600">Deadline: </span>
          <span
            className={`font-medium ${
              isOverdue ? 'text-red-600' : 'text-gray-900'
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
          <span className="badge bg-green-100 text-green-800 border border-green-300">
            ✓ Complete
          </span>
        ) : (project.progress || 0) > 0 ? (
          <span className="badge bg-blue-100 text-blue-800 border border-blue-300">
            🔄 In Progress
          </span>
        ) : (
          <span className="badge bg-gray-100 text-gray-800 border border-gray-300">
            ⏳ Not Started
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-3 border-t">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onEdit(project);
          }}
          className="text-sm text-primary-600 hover:underline"
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
          className="text-sm text-red-600 hover:underline"
        >
          Delete
        </button>
      </div>
    </div>
  );
};
