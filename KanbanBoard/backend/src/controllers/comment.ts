import { Response } from 'express';
import prisma from '../prisma';
import { Prisma } from '@prisma/client';
import { AuthRequest } from '../middleware/auth';
import { checkAccess } from '../utility/checkAuth';
import { async_catcher } from '../utility/catch';

export const createComment = async_catcher(cc);
export const updateComment = async_catcher(uc);
export const deleteComment = async_catcher(dc);

// helper to check who can create, modify, edit or delete comments based on their role in the project and ownership of the comment
async function getProjectIdFromTask(taskId: string): Promise<string | null> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    include: {
      column: { include: { board: true } },
      subtasks: { include: { column: { include: { board: true } } } },
    },
  });
  if (!task) return null;
  if (task.projectId) return task.projectId; //if its a story linked directly to the project, return the projectId directly from the task
  if (task.column?.board?.projectId) return task.column.board.projectId; // if it is a task/bug linked to a column, return the projectId from the parent column's board
  if (task.type === 'STORY' && task.subtasks && task.subtasks.length > 0) {
    return task.subtasks[0].column?.board?.projectId || null;
  }
  return null;
}

//CREATE COMMENTS
async function cc(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user?.userId;
  const taskId = req.params.taskId as string;
  if (!userId) {
    res.status(401).json({ error: 'AUTHENTICATION REQUIRED' });
  } else {
    if (!req.body.content) {
      res.status(400).json({ error: 'EMPTY COMMENT' });
      return;
    }
    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });
    if (!task) {
      res.status(404).json({ error: 'TASK NOT FOUND' });
    } else {
      const projectId = await getProjectIdFromTask(taskId);
      if (!projectId) {
        res.status(404).json({ error: 'PROJECT NOT FOUND FOR TASK' });
        return;
      }

      // only project members and above can comment on tasks in that project
      await checkAccess(
        userId,
        projectId,
        'PROJECT_MEMBER',
        req.user?.isGlobalAdmin,
        true
      );

      // Transaction: Create comment, log it, and send targeted notifications
      const createCommentAndLog = async (trans: Prisma.TransactionClient) => {
        // Force userId to be a string to prevent Set comparison failures
        const safeUserId = String(userId);

        const comment = await trans.comment.create({
          data: {
            content: req.body.content,
            issueId: taskId,
            authorId: userId,
          },
          include: {
            author: { select: { name: true } },
          },
        });

        // Audit trail for comments
        await trans.auditLog.create({
          data: {
            action: 'COMMENT_ADDED',
            newValue: req.body.content,
            issueId: taskId,
            userId: userId,
          },
        });

        const notificationsToCreate: Prisma.NotificationCreateManyInput[] = []; // Array of notifications to make
        const notifiedUserIds = new Set<string>(); // To make sure no user gets twice
        notifiedUserIds.add(safeUserId); // Already notified self (No need to send notification again)
        const mentionRegex = /@\[([^\]@]+)\]\(([^)[]+)\)/g; // Regular expression to make sure of mentioning
        const mentionedEmails: string[] = []; // Already mentioned emails
        let match;

        while ((match = mentionRegex.exec(req.body.content)) !== null) {
          if (match[2]) mentionedEmails.push(match[2]); // Extract mention from comment
        }
        if (mentionedEmails.length > 0) {
          const mentionedUsers = await trans.user.findMany({
            where: { email: { in: mentionedEmails } },
            select: { id: true },
          });

          mentionedUsers.forEach((u) => {
            // Create notification for each non-notified user
            const mentionedIdStr = String(u.id);
            if (mentionedIdStr !== safeUserId) {
              notifiedUserIds.add(mentionedIdStr);
              notificationsToCreate.push({
                userId: u.id,
                issueId: taskId,
                type: 'USER_MENTIONED',
                message: `${comment.author?.name || 'Someone'} mentioned you in a comment on: "${task.title}"`,
              });
            }
          });
        }
        const allMembers = await trans.project_Group.findMany({
          // All user method
          where: { projectId: projectId },
          select: { userId: true },
        });

        allMembers.forEach((m) => {
          const memberIdStr = String(m.userId);
          if (memberIdStr !== safeUserId && !notifiedUserIds.has(memberIdStr)) {
            notifiedUserIds.add(memberIdStr);
            notificationsToCreate.push({
              userId: m.userId,
              issueId: taskId,
              type: 'COMMENT_ADDED',
              message: `A new comment was added to the task: "${task.title}"`,
            });
          }
        });
        if (notificationsToCreate.length > 0) {
          await trans.notification.createMany({ data: notificationsToCreate });
        }

        return comment;
      };
      // Pass to create comment and create audit log
      const newComment = await prisma.$transaction(createCommentAndLog);
      res.status(201).json(newComment);
    }
  }
}

//UPDATE COMMENTS
async function uc(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user?.userId;
  const commentId = req.params.commentId as string;
  const { content } = req.body;

  if (!userId) {
    res.status(401).json({ error: 'AUTHENTICATION REQUIRED' });
  } else {
    if (!content) {
      res.status(400).json({ error: 'COMMENT CONTENT REQUIRED' });
      return;
    }

    // Fetch the existing comment to get its author and parent task
    const curComment = await prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!curComment) {
      res.status(404).json({ error: 'COMMENT NOT FOUND' });
    } else {
      const projectId = await getProjectIdFromTask(curComment.issueId);
      if (!projectId) {
        res.status(404).json({ error: 'PROJECT NOT FOUND' });
        return;
      }
      await checkAccess(
        userId,
        projectId,
        'PROJECT_VIEWER',
        req.user?.isGlobalAdmin,
        true
      );

      // Only the person who made the comment can edit it
      if (userId !== curComment.authorId) {
        res
          .status(403)
          .json({ error: 'ONLY THE AUTHOR CAN EDIT THIS COMMENT' });
        return;
      }
      //transaction to update comment and log the edit in the audit log
      const updateCommentAndLog = async (trans: Prisma.TransactionClient) => {
        const comment = await trans.comment.update({
          where: { id: commentId },
          data: { content: content },
        });

        await trans.auditLog.create({
          data: {
            action: 'COMMENT_EDITED',
            oldValue: curComment.content,
            newValue: content,
            issueId: curComment.issueId,
            userId: userId,
          },
        });
        // Fetch the task so we have the title for the notification
        const parentTask = await trans.task.findUnique({
          where: { id: curComment.issueId },
        });
        const allMembers = await trans.project_Group.findMany({
          where: { projectId: projectId },
          select: { userId: true },
        });
        const notifications = allMembers
          .filter((m) => m.userId !== userId) // Don't notify the editor
          .map((m) => ({
            userId: m.userId,
            issueId: curComment.issueId,
            type: 'COMMENT_EDITED',
            message: `A comment was edited on the task: "${parentTask?.title || 'Unknown Task'}"`,
          }));
        if (notifications.length > 0) {
          await trans.notification.createMany({ data: notifications });
        }
        return comment;
      };
      const update = await prisma.$transaction(updateCommentAndLog);
      res.status(200).json(update);
    }
  }
}

//DELETE COMMENTS
async function dc(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user?.userId;
  const commentId = req.params.commentId as string;

  if (!userId) {
    res.status(401).json({ error: 'AUTHENTICATION REQUIRED' });
  } else {
    const curComment = await prisma.comment.findUnique({
      where: { id: commentId },
    });

    if (!curComment) {
      res.status(404).json({ error: 'COMMENT NOT FOUND' });
      return;
    }
    // Get the projectId from the comment's parent task to check permissions
    const projectId = await getProjectIdFromTask(curComment.issueId);
    if (!projectId) {
      res.status(404).json({ error: 'PROJECT NOT FOUND' });
    } else {
      // must be atleast a project member to delete comments
      await checkAccess(
        userId,
        projectId,
        'PROJECT_VIEWER',
        req.user?.isGlobalAdmin,
        true
      );

      //  If not author, must be Admin
      if (userId !== curComment.authorId && !req.user?.isGlobalAdmin) {
        await checkAccess(
          userId,
          projectId,
          'PROJECT_ADMIN',
          req.user?.isGlobalAdmin
        );
      }

      // transaction to delete comment and log the deletion in the audit log, ensures that if the deletion fails, the audit log won't be created
      const del = async (trans: Prisma.TransactionClient) => {
        await trans.comment.delete({
          where: { id: commentId },
        });

        await trans.auditLog.create({
          data: {
            action: 'COMMENT_DELETED',
            oldValue: curComment.content, // Record what was deleted for the audit trail
            issueId: curComment.issueId,
            userId: userId,
          },
        });
      };
      await prisma.$transaction(del);
      res.status(200).json({ message: 'COMMENT DELETED SUCCESSFULLY' });
    }
  }
}
