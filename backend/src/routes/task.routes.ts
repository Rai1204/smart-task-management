import { Router } from 'express';
import {
  createTask,
  getTasks,
  getTaskById,
  updateTask,
  deleteTask,
  checkConflict,
  getCurrentWeekWorkload,
  checkOvercommitment,
} from '../controllers/task.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validator.js';
import { CreateTaskSchema, UpdateTaskSchema } from '@smart-task/contracts';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Tasks
 *   description: Task management endpoints
 */

// All task routes require authentication
router.use(authenticate);

router.post('/', validateRequest(CreateTaskSchema), createTask);
router.get('/', getTasks);
router.get('/:id', getTaskById);
router.put('/:id', validateRequest(UpdateTaskSchema), updateTask);
router.delete('/:id', deleteTask);
router.post('/check-conflict', checkConflict);

// Workload endpoints
router.get('/workload/current-week', getCurrentWeekWorkload);
router.post('/workload/check-overcommitment', checkOvercommitment);

export default router;
