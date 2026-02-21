import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ProjectResponse } from '@smart-task/contracts';
import { projectApi } from '@/api/projects';
import { ProjectCard } from '@/components/ProjectCard';
import { ProjectForm } from '@/components/ProjectForm';
import { MainLayout } from '@/components/MainLayout';
import toast from 'react-hot-toast';
import { getErrorMessage } from '@/lib/axios';

export const ProjectsPage: React.FC = () => {
  const [showForm, setShowForm] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectResponse | null>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Fetch all projects
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectApi.getProjects(),
  });

  // Handle opening project from URL params (e.g., from search)
  useEffect(() => {
    const projectId = searchParams.get('projectId');
    if (projectId && projects.length > 0) {
      const project = projects.find(p => p.id === projectId);
      if (project) {
        setEditingProject(project);
        setShowForm(true);
        // Clear the URL param after opening
        setSearchParams({});
      }
    }
  }, [searchParams, projects, setSearchParams]);

  // Delete project mutation
  const deleteProjectMutation = useMutation({
    mutationFn: projectApi.deleteProject,
    onSuccess: () => {
      queryClient.refetchQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast.success('Project deleted successfully!');
    },
    onError: (error) => {
      toast.error(getErrorMessage(error));
    },
  });

  const handleEdit = (project: ProjectResponse) => {
    setEditingProject(project);
    setShowForm(true);
  };

  const handleDelete = (projectId: string) => {
    deleteProjectMutation.mutate(projectId);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingProject(null);
  };

  const handleNewProject = () => {
    setEditingProject(null);
    setShowForm(true);
  };

  const handleProjectClick = (projectId: string) => {
    // Navigate to dashboard with project filter
    navigate(`/?project=${projectId}`);
  };

  if (isLoading) {
    return (
      <MainLayout onNewTask={handleNewProject} showFAB={false}>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 dark:border-primary-400 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Loading projects...</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout onNewTask={handleNewProject} showFAB={false}>
      {/* Header */}
      <div className="flex justify-between items-center mb-8 animate-fade-in">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Projects</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Organize your tasks into projects</p>
        </div>
        <button
          onClick={handleNewProject}
          className="btn btn-primary"
        >
          + New Project
        </button>
      </div>

      {/* Projects Grid */}
      {projects.length === 0 ? (
        <div className="text-center py-16 animate-fade-in">
          <div className="text-6xl mb-4">📁</div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            No projects yet
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Create your first project to start organizing your tasks
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="btn btn-primary"
          >
            Create Project
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
          {projects.map((project, index) => (
            <div
              key={project.id}
              className="animate-slide-up"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <ProjectCard
                project={project}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onClick={handleProjectClick}
              />
            </div>
          ))}
        </div>
      )}

      {/* Project Form Modal */}
      {showForm && (
        <ProjectForm
          project={editingProject}
          onClose={handleFormClose}
        />
      )}
    </MainLayout>
  );
};
