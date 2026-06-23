import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getUserNotifications,
  markAsRead,
  markAllAsRead,
} from '../controllers/notification';

const router = Router();

// AUTHENTICATION
router.use(authenticate);
// Fetch the user's notification history
router.get('/', getUserNotifications);
// Mark all as read (Put this BEFORE /:notificationId so "read-all" isn't treated as an ID)
router.patch('/read-all', markAllAsRead);
// Mark a specific notification as read
router.patch('/:notificationId/read', markAsRead);

export default router;
