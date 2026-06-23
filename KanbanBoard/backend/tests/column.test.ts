import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { mockDeep, mockReset, DeepMockProxy } from 'vitest-mock-extended';
import { PrismaClient, Column, Project_Group, Board } from '@prisma/client';

vi.mock('../src/prisma', () => ({
  default: mockDeep<PrismaClient>(),
}));
vi.mock('jsonwebtoken');

import request from 'supertest';
import app from '../src/index';
import prisma from '../src/prisma';
import jwt from 'jsonwebtoken';

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

describe('Column API Endpoints', () => {
  const mockUserId = 'user-123';
  const mockProjectId = 'proj-123';
  const mockBoardId = 'board-123';
  const mockColId = 'col-123';

  beforeEach(() => {
    mockReset(prismaMock);
    vi.clearAllMocks();

    // Mock Prisma transactions for the reorder endpoint
    // Handles array of promises (which your reorder endpoint uses)
    prismaMock.$transaction.mockImplementation(async (items: unknown) => {
      if (Array.isArray(items)) {
        return Promise.all(items);
      }
      return items;
    });
  });

  // Helper to fake login token
  const setAuthRole = (userId = mockUserId) => {
    (jwt.verify as unknown as Mock).mockReturnValue({
      userId,
      isGlobalAdmin: false,
    } as unknown as jwt.JwtPayload);
  };

  // Helper to fake RBAC checks in checkAccess()
  const setProjectRole = (
    role: 'PROJECT_ADMIN' | 'PROJECT_MEMBER' | 'PROJECT_VIEWER'
  ) => {
    prismaMock.project_Group.findUnique.mockResolvedValue({
      userId: mockUserId,
      projectId: mockProjectId,
      role: role,
    } as Project_Group);
  };

  // 1. POST /api/columns/board/:boardId (Create Column)
  describe('POST /api/columns/board/:boardId', () => {
    it('should allow Project Admin to create a column and auto-calculate order (201)', async () => {
      setAuthRole();
      setProjectRole('PROJECT_ADMIN'); // Must be Admin

      // Mock board lookup to find projectId
      prismaMock.board.findUnique.mockResolvedValue({
        id: mockBoardId,
        projectId: mockProjectId,
      } as Board);

      // Mock finding the last column to calculate the new order (e.g., last order was 2, new should be 3)
      prismaMock.column.findFirst.mockResolvedValue({ order: 2 } as Column);

      // Mock the creation
      prismaMock.column.create.mockResolvedValue({
        id: mockColId,
        name: 'Review',
        cStatus: 'REVIEW',
        order: 3,
        wipLimit: 5,
        boardId: mockBoardId,
      } as Column);

      const res = await request(app)
        .post(`/api/columns/board/${mockBoardId}`)
        .set('Cookie', ['token=fake-token'])
        .send({ name: 'Review', cStatus: 'REVIEW', wipLimit: 5 });

      expect(res.status).toBe(201);
      expect(res.body.order).toBe(3); // Verifies it correctly calculated 2 + 1
      expect(prismaMock.column.create).toHaveBeenCalledOnce();
    });

    it('should block non-admins from creating columns (403)', async () => {
      setAuthRole();
      setProjectRole('PROJECT_MEMBER'); // Insufficient permissions

      prismaMock.board.findUnique.mockResolvedValue({
        id: mockBoardId,
        projectId: mockProjectId,
      } as Board);

      const res = await request(app)
        .post(`/api/columns/board/${mockBoardId}`)
        .set('Cookie', ['token=fake-token'])
        .send({ name: 'Review', cStatus: 'REVIEW' });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('FORBIDDEN');
      expect(prismaMock.column.create).not.toHaveBeenCalled();
    });

    it('should return 404 if the board does not exist', async () => {
      setAuthRole();
      prismaMock.board.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .post('/api/columns/board/fake-board-id')
        .set('Cookie', ['token=fake-token'])
        .send({ name: 'Review', cStatus: 'REVIEW' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('BOARD NOT FOUND');
    });
  });

  // 2. PATCH /api/columns/:colId (Update Column)
  describe('PATCH /api/columns/:colId', () => {
    it('should allow Project Admin to update column properties (200)', async () => {
      setAuthRole();
      setProjectRole('PROJECT_ADMIN');

      prismaMock.column.findUnique.mockResolvedValue({
        id: mockColId,
        board: { projectId: mockProjectId },
      } as unknown as Column);

      prismaMock.column.update.mockResolvedValue({
        id: mockColId,
        name: 'Updated Name',
        wipLimit: 10,
        cStatus: 'IN_PROGRESS',
        order: 1,
        boardId: mockBoardId,
      } as Column);

      const res = await request(app)
        .patch(`/api/columns/${mockColId}`)
        .set('Cookie', ['token=fake-token'])
        .send({ name: 'Updated Name', wipLimit: 10 }); // Partial update

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Updated Name');
      expect(prismaMock.column.update).toHaveBeenCalledOnce();
    });
  });

  // 3. DELETE /api/columns/:colId (Delete Column)
  describe('DELETE /api/columns/:colId', () => {
    it('should delete column if it is empty and user is Admin (200)', async () => {
      setAuthRole();
      setProjectRole('PROJECT_ADMIN');

      // Mock the column returning 0 tasks (Empty!)
      prismaMock.column.findUnique.mockResolvedValue({
        id: mockColId,
        board: { projectId: mockProjectId },
        _count: { tasks: 0 },
      } as unknown as Column);

      const res = await request(app)
        .delete(`/api/columns/${mockColId}`)
        .set('Cookie', ['token=fake-token']);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('COLUMN DELETED SUCCESSFULLY');
      expect(prismaMock.column.delete).toHaveBeenCalledOnce();
    });

    it('should reject deletion if column contains tasks (400)', async () => {
      setAuthRole();

      // Mock the column returning > 0 tasks
      prismaMock.column.findUnique.mockResolvedValue({
        id: mockColId,
        board: { projectId: mockProjectId },
        _count: { tasks: 3 }, // Not empty!
      } as unknown as Column);

      const res = await request(app)
        .delete(`/api/columns/${mockColId}`)
        .set('Cookie', ['token=fake-token']);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('COLUMN NOT EMPTY'); // Verifies your safety check
      expect(prismaMock.column.delete).not.toHaveBeenCalled();
    });
  });

  // 4. PATCH /api/columns/reorder (Reorder Columns)
  describe('PATCH /api/columns/reorder', () => {
    it('should reorder multiple columns in a transaction (200)', async () => {
      setAuthRole();
      setProjectRole('PROJECT_ADMIN');

      // Mock finding the first column to verify RBAC
      prismaMock.column.findUnique.mockResolvedValue({
        id: 'col-1',
        board: { projectId: mockProjectId },
      } as unknown as Column);

      const payload = {
        columns: [
          { id: 'col-1', order: 2 },
          { id: 'col-2', order: 1 },
        ],
      };

      const res = await request(app)
        .patch('/api/columns/reorder')
        .set('Cookie', ['token=fake-token'])
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('COLUMNS REORDERED SUCCESSFULLY');
      expect(prismaMock.column.update).toHaveBeenCalledTimes(2);
    });

    it('should fail if no columns are provided (400)', async () => {
      setAuthRole();

      const res = await request(app)
        .patch('/api/columns/reorder')
        .set('Cookie', ['token=fake-token'])
        .send({ columns: [] }); // Empty array
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('COLUMNS ARRAY REQUIRED');
    });
  });
});
