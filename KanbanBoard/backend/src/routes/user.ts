import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getProfile,
  updateProfile,
  getAllUsers,
  changePassword,
} from '../controllers/user';

const router = Router();

router.use(authenticate);
router.get('/profile', authenticate, getProfile);
router.patch('/profile', authenticate, updateProfile);
router.get('/', getAllUsers); // Global Admin endpoint
router.patch('/password', authenticate, changePassword);
export default router;
