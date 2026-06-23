import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { mockDeep, mockReset, DeepMockProxy } from 'vitest-mock-extended';
import { PrismaClient, Board, Project_Group, Project } from '@prisma/client';

vi.mock('../src/prisma', () => ({
  default: mockDeep<PrismaClient>(),
}));
vi.mock('jsonwebtoken');

import request from 'supertest';
import app from '../src/index';
import prisma from '../src/prisma';
import jwt from 'jsonwebtoken';

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

describe('Board API Endpoints', () => {
  const mockUserId = 'user-123';
  const mockProjectId = 'proj-123';
  const mockBoardId = 'board-123';

  beforeEach(() => {
    mockReset(prismaMock);
    vi.clearAllMocks();
  });

  // Helper to mock the JWT token behavior
  const setAuthRole = (
    role: 'GLOBAL_ADMIN' | 'STANDARD_USER' = 'STANDARD_USER',
    userId = mockUserId
  ) => {
    (jwt.verify as unknown as Mock).mockReturnValue({
      userId,
      isGlobalAdmin: role === 'GLOBAL_ADMIN',
    } as unknown as jwt.JwtPayload);
  };

  // Helper to mock checkAccess() DB call
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

  // 1. POST /api/boards/project/:projectId (Create)
  describe('POST /api/boards/project/:projectId', () => {
    it('should allow a Project Admin to create a board (201)', async () => {
      setAuthRole();
      setProjectMember('PROJECT_ADMIN'); // RBAC requirement

      prismaMock.project.findUnique.mockResolvedValue({
        id: mockProjectId,
      } as Project);
      prismaMock.board.create.mockResolvedValue({
        id: mockBoardId,
        name: 'Sprint 1',
        projectId: mockProjectId,
      } as Board);

      const res = await request(app)
        .post(`/api/boards/project/${mockProjectId}`)
        .set('Cookie', ['token=fake-token'])
        .send({ name: 'Sprint 1' });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Sprint 1');
      expect(prismaMock.board.create).toHaveBeenCalledOnce();
    });

    it('should block non-admins from creating a board (403)', async () => {
      setAuthRole();
      setProjectMember('PROJECT_MEMBER'); // Insufficient permissions

      prismaMock.project.findUnique.mockResolvedValue({
        id: mockProjectId,
      } as Project);

      const res = await request(app)
        .post(`/api/boards/project/${mockProjectId}`)
        .set('Cookie', ['token=fake-token'])
        .send({ name: 'Hacked Board' });

      expect(res.status).toBe(403);
      expect(prismaMock.board.create).not.toHaveBeenCalled();
    });

    it('should return 400 if board name is missing', async () => {
      setAuthRole();
      const res = await request(app)
        .post(`/api/boards/project/${mockProjectId}`)
        .set('Cookie', ['token=fake-token'])
        .send({}); // Missing name

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('BOARD NAME REQUIRED');
    });

    it('should return 404 if the project does not exist', async () => {
      setAuthRole();
      prismaMock.project.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/boards/project/fake-proj-id')
        .set('Cookie', ['token=fake-token'])
        .send({ name: 'Sprint 1' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('PROJECT NOT FOUND');
    });
  });

  // 2. GET /api/boards/:boardId (Read)
  describe('GET /api/boards/:boardId', () => {
    it('should return board details and accurately set isCurrentUserAdmin flag for an admin (200)', async () => {
      setAuthRole();
      setProjectMember('PROJECT_ADMIN'); // Second call sets the isCurrentUserAdmin flag

      prismaMock.board.findUnique.mockResolvedValue({
        id: mockBoardId,
        name: 'Main Board',
        projectId: mockProjectId,
        project: { id: mockProjectId, name: 'Project' },
      } as unknown as Board);

      const res = await request(app)
        .get(`/api/boards/${mockBoardId}`)
        .set('Cookie', ['token=fake-token']);

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Main Board');
      expect(res.body.project.isCurrentUserAdmin).toBe(true); // Flag validation
    });

    it('should return board details but set isCurrentUserAdmin to false for a viewer (200)', async () => {
      setAuthRole();
      setProjectMember('PROJECT_VIEWER'); // Allowed to view, but is NOT an admin

      prismaMock.board.findUnique.mockResolvedValue({
        id: mockBoardId,
        name: 'Main Board',
        projectId: mockProjectId,
        project: { id: mockProjectId, name: 'Project' },
      } as unknown as Board);

      const res = await request(app)
        .get(`/api/boards/${mockBoardId}`)
        .set('Cookie', ['token=fake-token']);

      expect(res.status).toBe(200);
      expect(res.body.project.isCurrentUserAdmin).toBe(false);
    });

    it('should block users who are not in the project (403)', async () => {
      setAuthRole();
      setProjectMember(null); // Not in project

      prismaMock.board.findUnique.mockResolvedValue({
        id: mockBoardId,
        projectId: mockProjectId,
      } as Board);

      const res = await request(app)
        .get(`/api/boards/${mockBoardId}`)
        .set('Cookie', ['token=fake-token']);

      expect(res.status).toBe(403);
    });

    it('should return 404 if the board does not exist', async () => {
      setAuthRole();
      prismaMock.board.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .get('/api/boards/fake-board-id')
        .set('Cookie', ['token=fake-token']);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('BOARD NOT FOUND');
    });
  });

  // 3. PUT /api/boards/:boardId (Update)
  describe('PUT /api/boards/:boardId', () => {
    it('should allow Project Admins to update the board name (200)', async () => {
      setAuthRole();
      setProjectMember('PROJECT_ADMIN');

      prismaMock.board.findUnique.mockResolvedValue({
        id: mockBoardId,
        projectId: mockProjectId,
      } as Board);

      prismaMock.board.update.mockResolvedValue({
        id: mockBoardId,
        name: 'Updated Board',
        projectId: mockProjectId,
      } as Board);

      const res = await request(app)
        .put(`/api/boards/${mockBoardId}`)
        .set('Cookie', ['token=fake-token'])
        .send({ name: 'Updated Board' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Updated Board');
      expect(prismaMock.board.update).toHaveBeenCalledOnce();
    });

    it('should block standard members from updating the board name (403)', async () => {
      setAuthRole();
      setProjectMember('PROJECT_MEMBER'); // Insufficient permissions

      prismaMock.board.findUnique.mockResolvedValue({
        id: mockBoardId,
        projectId: mockProjectId,
      } as Board);

      const res = await request(app)
        .put(`/api/boards/${mockBoardId}`)
        .set('Cookie', ['token=fake-token'])
        .send({ name: 'Hacked Name' });

      expect(res.status).toBe(403);
      expect(prismaMock.board.update).not.toHaveBeenCalled();
    });
  });

  // 4. DELETE /api/boards/:boardId (Delete)
  describe('DELETE /api/boards/:boardId', () => {
    it('should allow Project Admins to delete a board (200)', async () => {
      setAuthRole();
      setProjectMember('PROJECT_ADMIN'); // RBAC check

      prismaMock.board.findUnique.mockResolvedValue({
        id: mockBoardId,
        projectId: mockProjectId,
      } as Board);

      prismaMock.board.delete.mockResolvedValue({ id: mockBoardId } as Board);

      const res = await request(app)
        .delete(`/api/boards/${mockBoardId}`)
        .set('Cookie', ['token=fake-token']);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('BOARD DELETED SUCCESSFULLY');
      expect(prismaMock.board.delete).toHaveBeenCalledOnce();
    });

    it('should return 404 if the board does not exist', async () => {
      setAuthRole();
      prismaMock.board.findUnique.mockResolvedValue(null); // Board missing

      const res = await request(app)
        .delete('/api/boards/fake-id')
        .set('Cookie', ['token=fake-token']);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('BOARD NOT FOUND');
    });
  });
});
