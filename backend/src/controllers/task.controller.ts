import { Request, Response, NextFunction } from 'express';
import { taskService, ConflictError } from '../services/task.service';
import { asyncHandler } from '../middleware/errorHandler';
import { AuthRequest } from '../middleware/auth';
import { ApiResponse } from '@smart-task/contracts';

/**
 * @swagger
 * /tasks:
 *   post:
 *     summary: Create a new task
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - type
 *               - startDateTime
 *             properties:
 *               title:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [reminder, duration]
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high]
 *               startDateTime:
 *                 type: string
 *                 format: date-time
 *               deadline:
 *                 type: string
 *                 format: date-time
 *               status:
 *                 type: string
 *                 enum: [pending, in-progress, completed]
 *               reminderEnabled:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: Task created successfully
 *       409:
 *         description: Conflict detected
 */
export const createTask = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const authReq = req as AuthRequest;
    const userId = authReq.user!.userId;

    try {
      const task = await taskService.createTask(userId, req.body);

      const response: ApiResponse = {
        success: true,
        data: task,
        message: 'Task created successfully',
      };

      res.status(201).json(response);
    } catch (error) {
      if (error instanceof ConflictError) {
        res.status(409).json({
          success: false,
          error: error.message,
          conflicts: error.conflictInfo,
        });
      } else {
        _next(error);
      }
    }
  }
);

/**
 * @swagger
 * /tasks:
 *   get:
 *     summary: Get all tasks for authenticated user
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, in-progress, completed]
 *       - in: query
 *         name: priority
 *         schema:
 *           type: string
 *           enum: [low, medium, high]
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [reminder, duration]
 *     responses:
 *       200:
 *         description: Tasks retrieved successfully
 */
export const getTasks = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const authReq = req as AuthRequest;
    const userId = authReq.user!.userId;

    const tasks = await taskService.getTasks(userId, req.query);

    const response: ApiResponse = {
      success: true,
      data: tasks,
    };

    res.status(200).json(response);
  }
);

/**
 * @swagger
 * /tasks/{id}:
 *   get:
 *     summary: Get a task by ID
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Task retrieved successfully
 *       404:
 *         description: Task not found
 */
export const getTaskById = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const authReq = req as AuthRequest;
    const userId = authReq.user!.userId;
    const taskId = req.params.id;

    const task = await taskService.getTaskById(userId, taskId);

    const response: ApiResponse = {
      success: true,
      data: task,
    };

    res.status(200).json(response);
  }
);

/**
 * @swagger
 * /tasks/{id}:
 *   put:
 *     summary: Update a task
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high]
 *               startDateTime:
 *                 type: string
 *                 format: date-time
 *               deadline:
 *                 type: string
 *                 format: date-time
 *               status:
 *                 type: string
 *                 enum: [pending, in-progress, completed]
 *               reminderEnabled:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Task updated successfully
 *       404:
 *         description: Task not found
 *       409:
 *         description: Conflict detected
 */
export const updateTask = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const authReq = req as AuthRequest;
    const userId = authReq.user!.userId;
    const taskId = req.params.id;

    try {
      const task = await taskService.updateTask(userId, taskId, req.body);

      const response: ApiResponse = {
        success: true,
        data: task,
        message: 'Task updated successfully',
      };

      res.status(200).json(response);
    } catch (error) {
      if (error instanceof ConflictError) {
        res.status(409).json({
          success: false,
          error: error.message,
          conflicts: error.conflictInfo,
        });
      } else {
        _next(error);
      }
    }
  }
);

/**
 * @swagger
 * /tasks/{id}:
 *   delete:
 *     summary: Delete a task
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Task deleted successfully
 *       404:
 *         description: Task not found
 */
export const deleteTask = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const authReq = req as AuthRequest;
    const userId = authReq.user!.userId;
    const taskId = req.params.id;

    await taskService.deleteTask(userId, taskId);

    const response: ApiResponse = {
      success: true,
      message: 'Task deleted successfully',
    };

    res.status(200).json(response);
  }
);

/**
 * @swagger
 * /tasks/check-conflict:
 *   post:
 *     summary: Check for scheduling conflicts
 *     tags: [Tasks]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - startDateTime
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [reminder, duration]
 *               startDateTime:
 *                 type: string
 *                 format: date-time
 *               deadline:
 *                 type: string
 *                 format: date-time
 *               excludeTaskId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Conflict check result
 */
export const checkConflict = asyncHandler(
  async (req: Request, res: Response, _next: NextFunction): Promise<void> => {
    const authReq = req as AuthRequest;
    const userId = authReq.user!.userId;

    const { type, startDateTime, deadline, excludeTaskId } = req.body;

    const conflictCheck = await taskService.checkConflicts(
      userId,
      new Date(startDateTime),
      deadline ? new Date(deadline) : undefined,
      type,
      excludeTaskId
    );

    const response: ApiResponse = {
      success: true,
      data: conflictCheck,
    };

    res.status(200).json(response);
  }
);
