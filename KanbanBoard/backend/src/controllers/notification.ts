import { Response } from 'express';
import prisma from '../prisma';
import { AuthRequest } from '../middleware/auth';
import { async_catcher } from '../utility/catch';

export const getUserNotifications = async_catcher(gn);
export const markAsRead = async_catcher(mar);
export const markAllAsRead = async_catcher(maar);

//GET ALL NOTIFICATIONS
async function gn(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user?.userId; // loads all notification for a given user
  if (!userId) {
    res.status(401).json({ error: 'AUTHENTICATION REQUIRED' });
  } else {
    // Fetch notifications, newest first
    const notifications = await prisma.notification.findMany({
      where: { userId: userId },
      orderBy: { createdAt: 'desc' },
    });
    res.status(200).json(notifications);
  }
}

//MARKING A NOTIFICATION AS READ
async function mar(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user?.userId;
  const notificationId = req.params.notificationId as string;
  if (!userId) {
    res.status(401).json({ error: 'AUTHENTICATION REQUIRED' });
  } else {
    // Verify the notification exists and belongs to the user
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
    });
    if (!notification) {
      res.status(404).json({ error: 'NOTIFICATION NOT FOUND' });
    } else {
      if (notification.userId !== userId) {
        res.status(403).json({ error: 'ACCESS DENIED' }); //cant view someone else's notification
      } else {
        // Update the status
        const updatedNotification = await prisma.notification.update({
          where: { id: notificationId },
          data: { isRead: true },
        });
        res.status(200).json(updatedNotification);
      }
    }
  }
}
//MARK ALL NOTIFICATION AS READ
async function maar(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ error: 'AUTHENTICATION REQUIRED' });
  } else {
    // Update all unread notifications for this user
    const result = await prisma.notification.updateMany({
      where: {
        userId: userId,
        isRead: false,
      },
      data: { isRead: true },
    });
    res
      .status(200)
      .json({ message: `MARKED ${result.count} NOTIFICATIONS AS READ` });
  }
}
