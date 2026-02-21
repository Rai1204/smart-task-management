import { Request, Response } from 'express';
import { ProjectService } from '../services/project.service.js';
import { CreateProjectSchema, UpdateProjectSchema, ApiResponse } from '@smart-task/contracts';
import { asyncHandler } from '../middleware/errorHandler.js';

const projectService = new ProjectService();

export const createProject = asyncHandler(async (req: Request, res: Response) => {
  // Validate request body
  const validatedData = CreateProjectSchema.parse(req.body);
  
  const project = await projectService.createProject(req.user!.userId, validatedData);
  
  const response: ApiResponse = {
    success: true,
    data: project,
    message: 'Project created successfully',
  };
  
  res.status(201).json(response);
});

export const getProjects = asyncHandler(async (req: Request, res: Response) => {
  const projects = await projectService.getProjects(req.user!.userId, req.query);
  
  const response: ApiResponse = {
    success: true,
    data: projects,
  };
  
  res.json(response);
});

export const getProjectById = asyncHandler(async (req: Request, res: Response) => {
  const project = await projectService.getProjectById(req.user!.userId, req.params.id);
  
  const response: ApiResponse = {
    success: true,
    data: project,
  };
  
  res.json(response);
});

export const updateProject = asyncHandler(async (req: Request, res: Response) => {
  // Validate request body
  const validatedData = UpdateProjectSchema.parse(req.body);
  
  const project = await projectService.updateProject(
    req.user!.userId,
    req.params.id,
    validatedData
  );
  
  const response: ApiResponse = {
    success: true,
    data: project,
    message: 'Project updated successfully',
  };
  
  res.json(response);
});

export const deleteProject = asyncHandler(async (req: Request, res: Response) => {
  await projectService.deleteProject(req.user!.userId, req.params.id);
  
  res.status(204).send();
});
