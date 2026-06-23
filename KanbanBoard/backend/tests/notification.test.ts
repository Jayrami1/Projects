import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { mockDeep, mockReset, DeepMockProxy } from 'vitest-mock-extended';
import { PrismaClient, Notification } from '@prisma/client';

vi.mock('../src/prisma', () => ({
  default: mockDeep<PrismaClient>(),
}));
vi.mock('jsonwebtoken');

import request from 'supertest';
import app from '../src/index';
import prisma from '../src/prisma';
import jwt from 'jsonwebtoken';

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

describe('Notification API Endpoints', () => {
  const mockUserId = 'user-123';
  const mockNotificationId = 'notif-123';

  beforeEach(() => {
    mockReset(prismaMock);
    vi.clearAllMocks();
  });

  // Helper to fake login token
  const setAuthRole = (userId = mockUserId) => {
    (jwt.verify as unknown as Mock).mockReturnValue({
      userId,
      isGlobalAdmin: false,
    } as unknown as jwt.JwtPayload);
  };

  // 1. GET /api/notifications (Fetch User's Notifications)
  describe('GET /api/notifications', () => {
    it('should return a list of notifications for the logged-in user (200)', async () => {
      setAuthRole();

      prismaMock.notification.findMany.mockResolvedValue([
        {
          id: mockNotificationId,
          message: 'Task updated',
          type: 'TASK_UPDATED',
          isRead: false,
          createdAt: new Date(),
          userId: mockUserId,
          issueId: 'task-123',
        } as Notification,
      ]);

      const res = await request(app)
        .get('/api/notifications')
        .set('Cookie', ['token=fake-token']);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(res.body[0].message).toBe('Task updated');

      // Verify the query specifically targeted the logged-in user and sorted by newest first
      expect(prismaMock.notification.findMany).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  // 2. PATCH /api/notifications/:notificationId/read
  describe('PATCH /api/notifications/:notificationId/read', () => {
    it('should mark a notification as read if owned by the user (200)', async () => {
      setAuthRole();

      // Mock finding the notification, ensuring it belongs to mockUserId
      prismaMock.notification.findUnique.mockResolvedValue({
        id: mockNotificationId,
        userId: mockUserId, // Owned by the requester
        isRead: false,
      } as Notification);

      prismaMock.notification.update.mockResolvedValue({
        id: mockNotificationId,
        isRead: true,
      } as Notification);

      const res = await request(app)
        .patch(`/api/notifications/${mockNotificationId}/read`)
        .set('Cookie', ['token=fake-token']);

      expect(res.status).toBe(200);
      expect(res.body.isRead).toBe(true);
      expect(prismaMock.notification.update).toHaveBeenCalledWith({
        where: { id: mockNotificationId },
        data: { isRead: true },
      });
    });

    it('should return 404 if notification is not found', async () => {
      setAuthRole();
      prismaMock.notification.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .patch(`/api/notifications/fake-id/read`)
        .set('Cookie', ['token=fake-token']);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('NOTIFICATION NOT FOUND');
    });

    it('should return 403 if trying to read someone elses notification', async () => {
      setAuthRole();

      // Mock the notification belonging to a completely different user
      prismaMock.notification.findUnique.mockResolvedValue({
        id: mockNotificationId,
        userId: 'hacker-user-id', // DIFFERENT user ID
      } as Notification);

      const res = await request(app)
        .patch(`/api/notifications/${mockNotificationId}/read`)
        .set('Cookie', ['token=fake-token']);

      // Expect your security check to trigger and block the update
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('ACCESS DENIED');
      expect(prismaMock.notification.update).not.toHaveBeenCalled();
    });
  });

  // 3. PATCH /api/notifications/read-all
  describe('PATCH /api/notifications/read-all', () => {
    it('should mark all unread notifications as read for the user (200)', async () => {
      setAuthRole();

      // Simulate Prisma updating 5 notifications
      prismaMock.notification.updateMany.mockResolvedValue({ count: 5 });

      const res = await request(app)
        .patch('/api/notifications/read-all')
        .set('Cookie', ['token=fake-token']);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('MARKED 5 NOTIFICATIONS AS READ');

      // Verify that it only updates UNREAD notifications belonging to THIS user
      expect(prismaMock.notification.updateMany).toHaveBeenCalledWith({
        where: {
          userId: mockUserId,
          isRead: false,
        },
        data: { isRead: true },
      });
    });
  });
});
