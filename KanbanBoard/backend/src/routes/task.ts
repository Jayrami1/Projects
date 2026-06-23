import { Router } from 'express';
import { create, deleteT, update, reorder, get } from '../controllers/task';
import { authenticate } from '../middleware/auth';
import { createComment } from '../controllers/comment';

const router: Router = Router();

router.use(authenticate); //Autheticate before changing tasks

//REORDER
router.patch('/reorder', reorder);
// CREATE
router.post('/column/:colId', create);
// UPDATE
router.patch('/:taskId', update);
// DELETE
router.delete('/:taskId', deleteT);
//GET TASK
router.get('/:taskId', get);
//COMMENTS
router.post('/:taskId/comments', createComment);

export default router;
