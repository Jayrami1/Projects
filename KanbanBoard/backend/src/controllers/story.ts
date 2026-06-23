import { Response } from 'express';
import prisma from '../prisma';
import { checkAccess } from '../utility/checkAuth';
import { AuthRequest } from '../middleware/auth';
import { async_catcher } from '../utility/catch';

export const createStory = async_catcher(cs);
export const getStories = async_catcher(gs);
export const deleteStory = async_catcher(ds);

async function cs(req: AuthRequest, res: Response): Promise<void> {
  // We grab the projectId directly from the URL route
  const projectId = req.params.projectId as string;
  const reporterId = req.user?.userId;
  if (!req.body.title) {
    res.status(400).json({ error: 'STORY TITLE REQUIRED' });
    return;
  }
  if (!reporterId) {
    res.status(401).json({ error: 'AUTHENTICATION REQUIRED' });
    return;
  }
  // the project should exist, otherwise we can't create a story under it
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) {
    res.status(404).json({ error: 'PROJECT NOT FOUND' });
    return;
  }
  //authority check - the user must have at least PROJECT_MEMBER access to the project to create a story under it
  await checkAccess(
    reporterId,
    projectId,
    'PROJECT_MEMBER',
    req.user?.isGlobalAdmin,
    true
  );
  //create story directly linked to the project (not linked to any column yet, as it will be created in the backlog and moved to the appropriate column when the team starts working on it)
  const newStory = await prisma.task.create({
    data: {
      title: req.body.title,
      description: req.body.description || null,
      type: 'STORY', // Hardcoded so they can't accidentally make a regular task here
      status: 'TO_DO',
      order: 0,
      projectId: projectId, // Link the story directly to the project
      reporterId: req.body.reporterId || reporterId,
    },
  });

  res.status(201).json(newStory);
}

async function gs(req: AuthRequest, res: Response): Promise<void> {
  //Get story funtionality
  const projectId = req.params.projectId as string;
  const userId = req.user?.userId;

  if (!userId) {
    res.status(401).json({ error: 'AUTHENTICATION REQUIRED' });
    return;
  }

  await checkAccess(
    userId,
    projectId,
    'PROJECT_VIEWER',
    req.user?.isGlobalAdmin
  );

  const stories = await prisma.task.findMany({
    where: {
      projectId: projectId,
      type: 'STORY',
    },
    include: {
      subtasks: {
        include: {
          column: {
            include: {
              board: true,
            },
          },
        },
      }, // Fetch the child tasks so the frontend can see progress
      assignee: { select: { id: true, name: true, avatarLink: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
  res.status(200).json(stories);
}

async function ds(req: AuthRequest, res: Response): Promise<void> {
  // Delete story functionality
  const userId = req.user?.userId;
  const storyId = req.params.storyId as string;

  if (!userId) {
    res.status(401).json({ error: 'AUTHENTICATION REQUIRED' });
    return;
  }
  // Find the story to check existence and get its projectId
  const story = await prisma.task.findUnique({
    where: { id: storyId },
  });
  if (!story || story.type !== 'STORY') {
    res.status(404).json({ error: 'STORY NOT FOUND' });
    return;
  }
  const projectId = story.projectId;
  if (!projectId) {
    res.status(400).json({ error: 'PROJECT NOT FOUND FOR STORY' });
    return;
  }
  // Authority check - only the project admins, or global admins can delete the story
  await checkAccess(
    userId,
    projectId,
    'PROJECT_ADMIN',
    req.user?.isGlobalAdmin,
    true
  );
  // Delete the story and set its subtasks to have no parent (making them standalone tasks)
  await prisma.$transaction(async (trans) => {
    await trans.task.updateMany({
      where: { parentId: storyId },
      data: { parentId: null },
    });
    await trans.task.delete({
      where: { id: storyId },
    });
  });
  res.status(200).json({
    message: 'STORY DELETED SUCCESSFULLY. ASSOCIATED TASKS ARE NOW STANDALONE.',
  });
}
