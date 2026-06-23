import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  createComment,
  updateComment,
  deleteComment,
} from '../controllers/comment';

const router = Router();

//MIDDLEWARE
// authentication step
router.use(authenticate);
//ROUTES
// Create a new comment on a specific task
router.post('/task/:taskId', createComment);
// Update an existing comment (Requires author or Project Admin)
router.put('/:commentId', updateComment);
// Delete a comment (Requires author or Project Admin)
router.delete('/:commentId', deleteComment);

export default router;
