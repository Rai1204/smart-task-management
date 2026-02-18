import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';

// Load environment variables FIRST before any other imports that might use them
dotenv.config();

import { connectDatabase } from './config/database';
import { errorHandler } from './middleware/errorHandler';
import { swaggerSpec } from './config/swagger';
import authRoutes from './routes/auth.routes';
import taskRoutes from './routes/task.routes';
import { startReminderService } from './services/reminder.service';

const app: Application = express();
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
}));

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Documentation
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// API Routes
const apiPrefix = process.env.API_PREFIX || '/api';
app.use(`${apiPrefix}/auth`, authRoutes);
app.use(`${apiPrefix}/tasks`, taskRoutes);

// Error handling
app.use(errorHandler);

// Start server
const startServer = async () => {
  try {
    // Connect to database
    await connectDatabase();
    
    // Start reminder service
    startReminderService();
    
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📚 API Documentation: http://localhost:${PORT}/api/docs`);
      console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export default app;
