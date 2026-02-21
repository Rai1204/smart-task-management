import { Request, Response } from 'express';
import { ProjectService } from '../services/project.service.js';
import { CreateProjectSchema, UpdateProjectSchema, ApiResponse } from '@smart-task/contracts';
import { asyncHandler } from '../middleware/errorHandler.js';
import { AuthRequest } from '../middleware/auth.js';

const projectService = new ProjectService();

export const createProject = asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  // Validate request body
  const validatedData = CreateProjectSchema.parse(req.body);
  
  const project = await projectService.createProject(authReq.user!.userId, validatedData);
  
  const response: ApiResponse = {
    success: true,
    data: project,
    message: 'Project created successfully',
  };
  
  res.status(201).json(response);
});

export const getProjects = asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const projects = await projectService.getProjects(authReq.user!.userId, req.query);
  
  const response: ApiResponse = {
    success: true,
    data: projects,
  };
  
  res.json(response);
});

export const getProjectById = asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  const project = await projectService.getProjectById(authReq.user!.userId, req.params.id);
  
  const response: ApiResponse = {
    success: true,
    data: project,
  };
  
  res.json(response);
});

export const updateProject = asyncHandler(async (req: Request, res: Response) => {
  const authReq = req as AuthRequest;
  // Validate request body
  const validatedData = UpdateProjectSchema.parse(req.body);
  
  const project = await projectService.updateProject(
    authReq.user!.userId,
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
  const authReq = req as AuthRequest;
  await projectService.deleteProject(authReq.user!.userId, req.params.id);
  
  res.status(204).send();
});
