import express from 'express';
import { createStory, deleteStory, getStories } from '../controllers/story';
import { authenticate } from '../middleware/auth';

const router = express.Router({ mergeParams: true }); // mergeParams lets you grab projectId from the URL

router.post('/', authenticate, createStory);
router.get('/', authenticate, getStories);
router.delete('/:storyId', authenticate, deleteStory);

export default router;
