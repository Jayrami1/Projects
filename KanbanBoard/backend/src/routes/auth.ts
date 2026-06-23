import { Router } from 'express';
import { register, login, logout, refresh } from '../controllers/auth';
const router: Router = Router();
router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout); // Deletes session from DB
router.post('/refresh', refresh); // Session renewal endpoint
export default router;
