import { Router } from 'express';
import { register, login } from '../controllers/auth.controller';
import { validateRequest } from '../middleware/validator';
import { RegisterSchema, LoginSchema } from '@smart-task/contracts';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Authentication
 *   description: User authentication endpoints
 */

router.post('/register', validateRequest(RegisterSchema), register);
router.post('/login', validateRequest(LoginSchema), login);

export default router;
