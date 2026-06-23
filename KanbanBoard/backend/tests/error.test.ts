import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { mockDeep, mockReset, DeepMockProxy } from 'vitest-mock-extended';
import { PrismaClient, Task, Project_Group } from '@prisma/client';
import request from 'supertest';
import app from '../src/index';
import prisma from '../src/prisma';
import jwt from 'jsonwebtoken';

vi.mock('../src/prisma', () => ({
  default: mockDeep<PrismaClient>(),
}));
vi.mock('jsonwebtoken');

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

describe('Global Error Handler Integration', () => {
  beforeEach(() => {
    mockReset(prismaMock);
    vi.clearAllMocks();

    // Ensure authentication middleware passes
    (jwt.verify as Mock).mockReturnValue({
      userId: 'user-123',
      isGlobalAdmin: false,
    });
  });

  it('should return 404 for a Prisma Record Not Found error (P2025)', async () => {
    prismaMock.task.update.mockRejectedValue({
      code: 'P2025',
    });

    const res = await request(app)
      .patch('/api/tasks/some-id')
      .set('Cookie', ['token=fake-token'])
      .send({ title: 'New Name' });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('TASK NOT FOUND');
  });

  it('should return 403 for insufficient RBAC permissions', async () => {
    // Mock the initial task fetch and then the RBAC failure
    prismaMock.task.findUnique.mockResolvedValue({
      id: 'task-123',
      column: { board: { projectId: 'proj-123' } },
    } as unknown as Task);

    prismaMock.project_Group.findUnique.mockResolvedValue({
      role: 'PROJECT_VIEWER', // Lower than required PROJECT_MEMBER
    } as unknown as Project_Group);

    const res = await request(app)
      .delete('/api/tasks/task-123')
      .set('Cookie', ['token=fake-token']);

    expect(res.status).toBe(403);
    expect(res.body.error).toBe(
      'FORBIDDEN: Your role does not allow this action.'
    );
  });
});
