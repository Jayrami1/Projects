import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { mockDeep, mockReset, DeepMockProxy } from 'vitest-mock-extended';
import { PrismaClient, Task, Project_Group, Project } from '@prisma/client';

vi.mock('../src/prisma', () => ({
  default: mockDeep<PrismaClient>(),
}));
vi.mock('jsonwebtoken');

import request from 'supertest';
import app from '../src/index';
import prisma from '../src/prisma';
import jwt from 'jsonwebtoken';

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

describe('Story API Endpoints', () => {
  const mockUserId = 'user-123';
  const mockProjectId = 'proj-123';
  const mockStoryId = 'story-123';

  beforeEach(() => {
    mockReset(prismaMock);
    vi.clearAllMocks();
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

  // Helper to fake RBAC checks inside checkAccess()
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

  // 1. POST /api/stories/project/:projectId (Create Story)
  describe('POST /api/project/:projectId/stories', () => {
    it('should create a Story directly linked to the project (201)', async () => {
      setAuthRole();
      setProjectMember('PROJECT_MEMBER');

      // Controller explicitly checks if project exists
      prismaMock.project.findUnique.mockResolvedValue({
        id: mockProjectId,
      } as Project);

      // Mock the story creation
      prismaMock.task.create.mockResolvedValue({
        id: mockStoryId,
        title: 'As a user, I want to view the backlog',
        type: 'STORY',
        projectId: mockProjectId,
        status: 'TO_DO',
      } as unknown as Task);

      const res = await request(app)
        .post(`/api/projects/${mockProjectId}/stories`) // Uses projectId, not colId!
        .set('Cookie', ['token=fake-token'])
        .send({ title: 'As a user, I want to view the backlog' });

      expect(res.status).toBe(201);
      expect(res.body.type).toBe('STORY');

      // Verify Prisma was called with the exact hardcoded fields from controller
      expect(prismaMock.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'As a user, I want to view the backlog',
            type: 'STORY',
            status: 'TO_DO',
            projectId: mockProjectId, // Verifies it links to project, not column
            order: 0,
          }),
        })
      );
    });

    it('should return 400 if the title is missing', async () => {
      setAuthRole();
      const res = await request(app)
        .post(`/api/projects/${mockProjectId}/stories`)
        .set('Cookie', ['token=fake-token'])
        .send({ description: 'I forgot the title' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('STORY TITLE REQUIRED'); // Matches code exactly
    });

    it('should return 404 if the project does not exist', async () => {
      setAuthRole();
      prismaMock.project.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .post(`/api/projects/${mockProjectId}/stories`)
        .set('Cookie', ['token=fake-token'])
        .send({ title: 'Valid Title' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('PROJECT NOT FOUND');
    });

    it('should return 403 if the user is not a project member', async () => {
      setAuthRole();
      setProjectMember(null); // Triggers checkAccess failure

      prismaMock.project.findUnique.mockResolvedValue({
        id: mockProjectId,
      } as Project);

      const res = await request(app)
        .post(`/api/projects/${mockProjectId}/stories`)
        .set('Cookie', ['token=fake-token'])
        .send({ title: 'Hacked Title' });

      expect(res.status).toBe(403);
      expect(prismaMock.task.create).not.toHaveBeenCalled();
    });
  });

  // 2. GET /api/stories/project/:projectId (Get Stories)
  describe('GET /api/project/:projectId/stories', () => {
    it('should return all stories with deeply nested subtasks (200)', async () => {
      setAuthRole();
      setProjectMember('PROJECT_VIEWER'); // Viewers are allowed

      // Mock the deeply nested payload controller requests
      prismaMock.task.findMany.mockResolvedValue([
        {
          id: mockStoryId,
          title: 'Epic Login Story',
          type: 'STORY',
          projectId: mockProjectId,
          subtasks: [
            {
              id: 'sub-1',
              title: 'Backend Route',
              column: { board: { name: 'Sprint 1' } },
            },
          ],
          assignee: { id: 'user-1', name: 'Dev', avatarLink: null },
        } as unknown as Task,
      ]);

      const res = await request(app)
        .get(`/api/projects/${mockProjectId}/stories`)
        .set('Cookie', ['token=fake-token']);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);

      // Verify the query params sent to Prisma match controller logic
      expect(prismaMock.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { projectId: mockProjectId, type: 'STORY' },
          orderBy: { createdAt: 'desc' },
        })
      );
    });

    it('should block users who do not have Project Viewer access (403)', async () => {
      setAuthRole();
      setProjectMember(null); //Unauth hacker
      const res = await request(app)
        .get(`/api/projects/${mockProjectId}/stories`)
        .set('Cookie', ['token=fake-token']);

      expect(res.status).toBe(403);
      expect(prismaMock.task.findMany).not.toHaveBeenCalled();
    });
    it('should return stories with their derived subtasks to show progress (200)', async () => {
      setAuthRole();
      setProjectMember('PROJECT_VIEWER');
      // Mock a Story that has multiple children (subtasks)
      const mockStoryWithChildren = [
        {
          id: mockStoryId,
          title: 'Major Feature Story',
          type: 'STORY',
          subtasks: [
            { id: 'sub-1', title: 'Task A', status: 'DONE' },
            { id: 'sub-2', title: 'Task B', status: 'IN_PROGRESS' },
          ],
          assignee: { id: 'dev-1', name: 'Alice', avatarLink: null },
        },
      ] as unknown as Task[];

      prismaMock.task.findMany.mockResolvedValue(mockStoryWithChildren);

      const res = await request(app)
        .get(`/api/projects/${mockProjectId}/stories`)
        .set('Cookie', ['token=fake-token']);

      expect(res.status).toBe(200);

      // Verify the subtasks were "derived" and included
      expect(res.body[0].subtasks).toHaveLength(2);
      expect(res.body[0].subtasks[0].status).toBe('DONE');

      // Verify Prisma 'include' logic was requested
      // Replace the findMany expectation with this:
      expect(prismaMock.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { projectId: mockProjectId, type: 'STORY' },
          include: expect.objectContaining({
            assignee: expect.any(Object),
            subtasks: expect.objectContaining({
              include: expect.objectContaining({
                column: expect.any(Object),
              }),
            }),
          }),
          orderBy: { createdAt: 'desc' },
        })
      );
    });
  });
  // 3. DELETE /api/projects/:projectId/stories/:storyId
  describe('DELETE /api/projects/:projectId/stories/:storyId', () => {
    it('should allow PROJECT_ADMIN to delete a story and detach subtasks (200)', async () => {
      setAuthRole();
      setProjectMember('PROJECT_ADMIN');

      prismaMock.task.findUnique.mockResolvedValue({
        id: mockStoryId,
        type: 'STORY',
        projectId: mockProjectId,
      } as unknown as Task);

      const txMock = {
        task: {
          updateMany: vi.fn().mockResolvedValue({ count: 1 }),
          delete: vi.fn().mockResolvedValue({ id: mockStoryId }),
        },
      };
      prismaMock.$transaction.mockImplementationOnce(async (callback) => {
        const transactionCallback = callback as unknown as (
          client: typeof txMock
        ) => Promise<unknown>;
        return await transactionCallback(txMock);
      });
      const res = await request(app)
        .delete(`/api/projects/${mockProjectId}/stories/${mockStoryId}`)
        .set('Cookie', ['token=fake-token']);
      expect(res.status).toBe(200);
      expect(res.body.message).toContain('STORY DELETED SUCCESSFULLY');
      expect(txMock.task.updateMany).toHaveBeenCalledWith({
        where: { parentId: mockStoryId },
        data: { parentId: null },
      });
      expect(txMock.task.delete).toHaveBeenCalledWith({
        where: { id: mockStoryId },
      });
    });
    it('should block standard members from deleting a story (403)', async () => {
      setAuthRole();
      setProjectMember('PROJECT_MEMBER');
      prismaMock.task.findUnique.mockResolvedValue({
        id: mockStoryId,
        type: 'STORY',
        projectId: mockProjectId,
      } as unknown as Task);
      const res = await request(app)
        .delete(`/api/projects/${mockProjectId}/stories/${mockStoryId}`)
        .set('Cookie', ['token=fake-token']);

      expect(res.status).toBe(403);
    });
    it('should return 404 if the story does not exist', async () => {
      setAuthRole();
      prismaMock.task.findUnique.mockResolvedValue(null);
      const res = await request(app)
        .delete(`/api/projects/${mockProjectId}/stories/fake-story`)
        .set('Cookie', ['token=fake-token']);
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('STORY NOT FOUND');
    });
  });
});
