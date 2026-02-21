import { ProjectModel } from '../models/project.model.js';
import { TaskModel } from '../models/task.model.js';
import {
  CreateProjectDto,
  UpdateProjectDto,
  ProjectResponse,
  ProjectQueryParams,
  PROJECT_COLORS,
  TaskStatus,
} from '@smart-task/contracts';
import { AppError } from '../middleware/errorHandler.js';

export class ProjectService {
  /**
   * Create a new project
   */
  async createProject(userId: string, data: CreateProjectDto): Promise<ProjectResponse> {
    // Assign random color if not provided
    const color = data.color || PROJECT_COLORS[Math.floor(Math.random() * PROJECT_COLORS.length)];
    const deadline = data.deadline ? new Date(data.deadline) : undefined;

    const project = await ProjectModel.create({
      userId,
      name: data.name,
      description: data.description,
      color,
      deadline,
    });

    return await this.toProjectResponse(project);
  }

  /**
   * Get all projects for a user
   */
  async getProjects(userId: string, _params: ProjectQueryParams): Promise<ProjectResponse[]> {
    const query: any = { userId };

    const projects = await ProjectModel.find(query).sort({ createdAt: -1 });

    return await Promise.all(projects.map((project) => this.toProjectResponse(project)));
  }

  /**
   * Get a single project by ID
   */
  async getProjectById(userId: string, projectId: string): Promise<ProjectResponse> {
    const project = await ProjectModel.findOne({ _id: projectId, userId });

    if (!project) {
      throw new AppError('Project not found', 404);
    }

    return await this.toProjectResponse(project);
  }

  /**
   * Update a project
   */
  async updateProject(
    userId: string,
    projectId: string,
    data: UpdateProjectDto
  ): Promise<ProjectResponse> {
    const project = await ProjectModel.findOne({ _id: projectId, userId });

    if (!project) {
      throw new AppError('Project not found', 404);
    }

    // Update fields
    if (data.name !== undefined) project.name = data.name;
    if (data.description !== undefined) project.description = data.description;
    if (data.color !== undefined) project.color = data.color;
    if (data.deadline !== undefined) project.deadline = new Date(data.deadline);

    await project.save();

    return await this.toProjectResponse(project);
  }

  /**
   * Delete a project
   */
  async deleteProject(userId: string, projectId: string): Promise<void> {
    const project = await ProjectModel.findOne({ _id: projectId, userId });

    if (!project) {
      throw new AppError('Project not found', 404);
    }

    // Remove projectId from all tasks in this project
    await TaskModel.updateMany(
      { userId, projectId },
      { $unset: { projectId: '' } }
    );

    await ProjectModel.deleteOne({ _id: projectId, userId });
  }

  /**
   * Convert project document to response format
   */
  private async toProjectResponse(project: any): Promise<ProjectResponse> {
    // Count tasks in this project
    const taskCount = await TaskModel.countDocuments({
      userId: project.userId,
      projectId: project.id,
    });

    // Count completed tasks
    const completedTaskCount = await TaskModel.countDocuments({
      userId: project.userId,
      projectId: project.id,
      status: TaskStatus.COMPLETED,
    });

    // Calculate progress
    const progress = taskCount > 0 ? Math.round((completedTaskCount / taskCount) * 100) : 0;

    return {
      id: project.id,
      userId: project.userId,
      name: project.name,
      description: project.description,
      color: project.color,
      deadline: project.deadline ? project.deadline.toISOString() : undefined,
      taskCount,
      completedTaskCount,
      progress,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
    };
  }
}
