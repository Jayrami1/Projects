import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { mockDeep, mockReset, DeepMockProxy } from 'vitest-mock-extended';
import {
  PrismaClient,
  Prisma,
  Comment,
  Task,
  Project_Group,
  User,
} from '@prisma/client';

vi.mock('../src/prisma', () => ({
  default: mockDeep<PrismaClient>(),
}));

vi.mock('jsonwebtoken');

import request from 'supertest';
import app from '../src/index';
import prisma from '../src/prisma';
import jwt from 'jsonwebtoken';

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

describe('Comment API Endpoints', () => {
  const mockUserId = 'user-123';
  const mockProjectId = 'proj-123';
  const mockTaskId = 'task-123';
  const mockCommentId = 'comment-123';

  beforeEach(() => {
    mockReset(prismaMock);
    vi.clearAllMocks();

    // Safely execute Prisma transactions, which your comment controller relies on for AuditLogs and Notifications
    prismaMock.$transaction.mockImplementation(
      async (callbackOrArray: unknown) => {
        if (typeof callbackOrArray === 'function') {
          return await callbackOrArray(
            prismaMock as unknown as Prisma.TransactionClient
          );
        }
        return Promise.all(callbackOrArray as Promise<unknown>[]);
      }
    );
  });

  // Helper to fake login token
  const setAuthRole = (
    role: 'GLOBAL_ADMIN' | 'STANDARD_USER' = 'STANDARD_USER',
    userId = mockUserId
  ) => {
    (jwt.verify as unknown as Mock).mockReturnValue({
      userId,
      isGlobalAdmin: role === 'GLOBAL_ADMIN',
    } as unknown as jwt.JwtPayload);
  };

  // Helper to fake RBAC checks in checkAccess()
  const setProjectMember = (
    role:
      | 'PROJECT_MEMBER'
      | 'PROJECT_ADMIN'
      | 'PROJECT_VIEWER'
      | null = 'PROJECT_MEMBER'
  ) => {
    if (!role) {
      prismaMock.project_Group.findUnique.mockResolvedValue(null);
    } else {
      prismaMock.project_Group.findUnique.mockResolvedValue({
        userId: mockUserId,
        projectId: mockProjectId,
        role: role,
      } as Project_Group);
    }
  };

  // Helper to mock the `getProjectIdFromTask` hierarchy traversal
  const mockTaskHierarchy = () => {
    prismaMock.task.findUnique.mockResolvedValue({
      id: mockTaskId,
      title: 'Task Title',
      column: { board: { projectId: mockProjectId } },
    } as unknown as Task);
  };

  // 1. POST /api/comments/task/:taskId (Create)
  describe('POST /api/comments/task/:taskId', () => {
    it('should create a comment and send generic notifications to members (201)', async () => {
      setAuthRole();
      setProjectMember('PROJECT_MEMBER');
      mockTaskHierarchy();
      prismaMock.project_Group.findMany.mockResolvedValue([
        { userId: 'other-user-1' } as Project_Group,
      ]);
      prismaMock.comment.create.mockResolvedValue({
        id: mockCommentId,
        content: 'Looks good!',
        issueId: mockTaskId,
        authorId: mockUserId,
      } as Comment);
      const res = await request(app)
        .post(`/api/comments/task/${mockTaskId}`)
        .set('Cookie', ['token=fake-token'])
        .send({ content: 'Looks good!' });
      expect(res.status).toBe(201);
      expect(prismaMock.comment.create).toHaveBeenCalledOnce();
      expect(prismaMock.auditLog.create).toHaveBeenCalledOnce();
      expect(prismaMock.notification.createMany).toHaveBeenCalledOnce();
    });

    it('should parse Regex Mentions and send specific MENTION notifications (201)', async () => {
      setAuthRole();
      setProjectMember('PROJECT_MEMBER');
      mockTaskHierarchy();

      // Simulate the Regex finding the email and querying the database for that user's ID
      prismaMock.user.findMany.mockResolvedValue([
        { id: 'mentioned-user-999', email: 'test@test.com' } as User,
      ]);
      prismaMock.project_Group.findMany.mockResolvedValue([]); // No other members for this test

      prismaMock.comment.create.mockResolvedValue({
        id: mockCommentId,
      } as Comment);

      const res = await request(app)
        .post(`/api/comments/task/${mockTaskId}`)
        .set('Cookie', ['token=fake-token'])
        .send({ content: 'Hey @[test](test@test.com), please review this.' });

      expect(res.status).toBe(201);
      expect(prismaMock.user.findMany).toHaveBeenCalledOnce(); // Proves the Regex triggered the DB lookup
      expect(prismaMock.notification.createMany).toHaveBeenCalledOnce();

      // Use toHaveBeenCalledWith to safely check the payload without digging into mock.calls
      expect(prismaMock.notification.createMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({
              userId: 'mentioned-user-999',
              type: 'USER_MENTIONED',
            }),
          ]),
        })
      );
    });

    it('should reject empty comments (400)', async () => {
      setAuthRole();
      const res = await request(app)
        .post(`/api/comments/task/${mockTaskId}`)
        .set('Cookie', ['token=fake-token'])
        .send({ content: '' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('EMPTY COMMENT');
    });

    it('should return 404 if the parent task does not exist', async () => {
      setAuthRole();
      prismaMock.task.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/comments/task/fake-task-id')
        .set('Cookie', ['token=fake-token'])
        .send({ content: 'Hello' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('TASK NOT FOUND');
    });
  });

  // 2. PUT /api/comments/:commentId (Update)
  describe('PUT /api/comments/:commentId', () => {
    it('should allow the AUTHOR to update their own comment (200)', async () => {
      setAuthRole();
      setProjectMember('PROJECT_VIEWER');
      mockTaskHierarchy(); // Used for notification context

      // Mock finding the comment, verifying the author matches our token
      prismaMock.comment.findUnique.mockResolvedValue({
        id: mockCommentId,
        content: 'Old Content',
        issueId: mockTaskId,
        authorId: mockUserId, // Match
      } as Comment);

      prismaMock.comment.update.mockResolvedValue({
        id: mockCommentId,
        content: 'Updated',
      } as Comment);
      prismaMock.project_Group.findMany.mockResolvedValue([]);

      const res = await request(app)
        .put(`/api/comments/${mockCommentId}`)
        .set('Cookie', ['token=fake-token'])
        .send({ content: 'Updated' });

      expect(res.status).toBe(200);
      expect(prismaMock.comment.update).toHaveBeenCalledOnce();
      expect(prismaMock.auditLog.create).toHaveBeenCalledOnce(); // Proves edits are audited
    });

    it('should strictly block anyone else from editing a comment (403)', async () => {
      setAuthRole();
      setProjectMember('PROJECT_ADMIN'); // Even an admin shouldn't edit someone else's comment
      mockTaskHierarchy();

      prismaMock.comment.findUnique.mockResolvedValue({
        id: mockCommentId,
        content: 'Old Content',
        issueId: mockTaskId,
        authorId: 'some-other-user', // Mismatch
      } as Comment);

      const res = await request(app)
        .put(`/api/comments/${mockCommentId}`)
        .set('Cookie', ['token=fake-token'])
        .send({ content: 'I am hacking your comment' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('ONLY THE AUTHOR CAN EDIT THIS COMMENT');
      expect(prismaMock.comment.update).not.toHaveBeenCalled();
    });
  });

  // 3. DELETE /api/comments/:commentId (Delete)
  describe('DELETE /api/comments/:commentId', () => {
    it('should allow the AUTHOR to delete their comment (200)', async () => {
      setAuthRole();
      setProjectMember('PROJECT_VIEWER');
      mockTaskHierarchy();

      prismaMock.comment.findUnique.mockResolvedValue({
        id: mockCommentId,
        content: 'Mistake',
        issueId: mockTaskId,
        authorId: mockUserId, // Matches token
      } as Comment);

      const res = await request(app)
        .delete(`/api/comments/${mockCommentId}`)
        .set('Cookie', ['token=fake-token']);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('COMMENT DELETED SUCCESSFULLY');
      expect(prismaMock.comment.delete).toHaveBeenCalledOnce();
      expect(prismaMock.auditLog.create).toHaveBeenCalledOnce(); // Deletions must be audited!
    });

    it('should allow a PROJECT ADMIN to delete someone elses comment (200)', async () => {
      setAuthRole();
      setProjectMember('PROJECT_ADMIN');
      mockTaskHierarchy();

      prismaMock.comment.findUnique.mockResolvedValue({
        id: mockCommentId,
        content: 'Inappropriate content',
        issueId: mockTaskId,
        authorId: 'rule-breaker-123', // Mismatch!
      } as Comment);

      const res = await request(app)
        .delete(`/api/comments/${mockCommentId}`)
        .set('Cookie', ['token=fake-token']);

      expect(res.status).toBe(200);
      expect(prismaMock.comment.delete).toHaveBeenCalledOnce();
    });

    it('should block a standard viewer from deleting someone elses comment (403)', async () => {
      setAuthRole();
      setProjectMember('PROJECT_VIEWER'); // Not the author, and not an admin
      mockTaskHierarchy();

      prismaMock.comment.findUnique.mockResolvedValue({
        id: mockCommentId,
        content: 'Normal comment',
        issueId: mockTaskId,
        authorId: 'someone-else',
      } as Comment);

      const res = await request(app)
        .delete(`/api/comments/${mockCommentId}`)
        .set('Cookie', ['token=fake-token']);

      // Expect globalErrorHandler to catch INSUFFICIENT_PERMISSIONS
      expect(res.status).toBe(403);
    });
  });
});
