import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { mockDeep, mockReset, DeepMockProxy } from 'vitest-mock-extended';
import { PrismaClient, User, Project, Project_Group } from '@prisma/client';
import request from 'supertest';
import app from '../src/index';
import prisma from '../src/prisma';
import jwt from 'jsonwebtoken';

vi.mock('../src/prisma', () => ({
  default: mockDeep<PrismaClient>(),
}));
vi.mock('jsonwebtoken');

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

describe('Security and RBAC Integration', () => {
  const mockUserId = 'user-sec-123';
  const mockProjectId = 'proj-sec-123';

  beforeEach(() => {
    mockReset(prismaMock);
    vi.clearAllMocks();
  });

  const setAuthContext = (userId: string, isGlobalAdmin?: boolean) => {
    (jwt.verify as unknown as Mock).mockReturnValue({
      userId,
      isGlobalAdmin,
    } as unknown as jwt.JwtPayload);
  };

  it('should allow access via Global Admin database fallback if the JWT flag is missing', async () => {
    setAuthContext(mockUserId, undefined);

    prismaMock.user.findUnique.mockResolvedValue({
      id: mockUserId,
      isGLOBAL_ADMIN: true,
    } as User);
    prismaMock.project.findUnique.mockResolvedValue({
      id: mockProjectId,
      name: 'Secure Proj',
    } as unknown as Project);

    const res = await request(app)
      .get(`/api/projects/${mockProjectId}`)
      .set('Cookie', ['token=fake-token']);

    expect(res.status).toBe(200);
  });

  it('should return 403 when a member has insufficient hierarchy for an action', async () => {
    setAuthContext(mockUserId, false);
    prismaMock.project_Group.findUnique.mockResolvedValue({
      userId: mockUserId,
      projectId: mockProjectId,
      role: 'PROJECT_VIEWER',
    } as unknown as Project_Group);

    const res = await request(app)
      .delete(`/api/projects/${mockProjectId}`)
      .set('Cookie', ['token=fake-token']);

    expect(res.status).toBe(403);
  });
});
