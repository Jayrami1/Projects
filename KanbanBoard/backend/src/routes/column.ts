import { Router } from 'express';
import {
  createCol,
  deleteCol,
  updateCol,
  reorderCol,
} from '../controllers/column';
import { authenticate } from '../middleware/auth';
const router: Router = Router();
// Apply authentication to all column routes
router.use(authenticate);

//  CREATE
router.post('/board/:boardId', createCol);
// REORDER
router.patch('/reorder', reorderCol);
// DELETE
router.delete('/:colId', deleteCol);
// UPDATE
router.patch('/:colId', updateCol); // patch used to partially update

export default router;
