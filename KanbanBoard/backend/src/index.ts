import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import cors from 'cors';

dotenv.config({ path: path.resolve(__dirname, '../.env') });
// eslint-disable-next-line no-console
console.log('Connecting to:', process.env.DATABASE_URL);

import cookieParser from 'cookie-parser'; // Import
// Add to your imports
import userRoutes from './routes/user';
import authRoutes from './routes/auth';
import projectRoutes from './routes/routes'; // src/routes/routes.ts contains project endpoints
import boardRoutes from './routes/board'; // similar for board and column
import columnRoutes from './routes/column';
import taskRoutes from './routes/task';
import commentRoutes from './routes/comment';
import notificationRoutes from './routes/notification';
import storyRoutes from './routes/story';

// global error handler
import { globalErrorHandler } from './middleware/error';
const app = express();
const PORT = process.env.PORT || 3000;

app.use(
  cors({
    // CORS setup to allow requests from the React frontend
    origin: 'http://localhost:5173', // Allow your React frontend
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    credentials: true, // Crucial for sending cookies/JWTs
  })
);
app.use(express.json({ limit: '10mb' })); // Increased limit to allow Base64 image uploads; // Middleware to parse incoming JSON data
app.use(cookieParser()); // Use cookie-parser for JWT session management
app.use('/uploads', express.static('uploads')); // Upload user image

// Mount API Routes
app.use('/api/auth', authRoutes); // Registration and Login
app.use('/api/projects', projectRoutes); // Project Management and User Assignment
app.use('/api/boards', boardRoutes); // Board CRUD operations
app.use('/api/columns', columnRoutes); // Column management and reordering
app.use('/api/tasks', taskRoutes); // Task CRUD and reordering
app.use('/api/comments', commentRoutes); // Comment CRUD operations
app.use('/api/notifications', notificationRoutes); // Notification retrieval and management
app.use('/api/users', userRoutes); // Mount the user routes
app.use('/api/projects/:projectId/stories', storyRoutes); // Story CRUD operations within a project
// Handler for undefined routes
app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global Error Handler
// This handles INSUFFICIENT_PERMISSIONS, NOT_IN_PROJECT, and Prisma errors as mentioned in middleware error
app.use(globalErrorHandler);
export default app;
//Start the localhost only when we are not testing
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}
