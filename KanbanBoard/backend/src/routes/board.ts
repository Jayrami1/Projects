import { Router } from 'express';
import { get, create, update, deleteB } from '../controllers/board';
import { authenticate } from '../middleware/auth';

const router: Router = Router();
// Requires a valid JWT to access.
router.use(authenticate); // Authenticate middleware before accessing any board routes

//ROUTES
// GET
router.get('/:boardId', get);
// CREATE
router.post('/project/:projectId', create);
// PUT
router.put('/:boardId', update);
// DELETE
router.delete('/:boardId', deleteB);

export default router;
