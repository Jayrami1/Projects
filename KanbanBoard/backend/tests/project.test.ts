import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { mockDeep, mockReset, DeepMockProxy } from 'vitest-mock-extended';
import {
  PrismaClient,
  Prisma,
  Project,
  Project_Group,
  Role,
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

describe('Project API Endpoints', () => {
  const mockProjectId = 'proj-123';
  const mockUserId = 'user-123';

  const mockProject: Project = {
    id: mockProjectId,
    name: 'Vitest Project',
    description: 'Comprehensive testing project',
    workflow: null,
    isArchived: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    mockReset(prismaMock);
    vi.clearAllMocks();
    // This safely executes the callback using our prismaMock
    prismaMock.$transaction.mockImplementation(async (callback: unknown) => {
      if (typeof callback === 'function') {
        return await callback(
          prismaMock as unknown as Prisma.TransactionClient
        );
      }
      return Promise.all(callback as Promise<unknown>[]);
    });
  });

  // Helper to mock the JWT token behavior
  const setAuthRole = (
    role: 'GLOBAL_ADMIN' | 'STANDARD_USER',
    userId = mockUserId
  ) => {
    (jwt.verify as unknown as Mock).mockReturnValue({
      userId,
      isGlobalAdmin: role === 'GLOBAL_ADMIN',
    } as unknown as jwt.JwtPayload);
  };
  const setProjectRole = (role: Role | null) => {
    if (role === null) {
      prismaMock.project_Group.findUnique.mockResolvedValue(null);
    } else {
      prismaMock.project_Group.findUnique.mockResolvedValue({
        id: 'group-1',
        userId: mockUserId,
        projectId: mockProjectId,
        role: role,
      } as Project_Group);
    }
  };

  // 1. POST /api/projects (Create)
  describe('POST /api/projects', () => {
    it('should allow Global Admin to create a project (201)', async () => {
      setAuthRole('GLOBAL_ADMIN');
      prismaMock.project.create.mockResolvedValue(mockProject);
      prismaMock.project_Group.create.mockResolvedValue({} as Project_Group);

      const res = await request(app)
        .post('/api/projects')
        .set('Cookie', ['token=fake-token'])
        .send({ name: 'Vitest Project', description: 'Testing' });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Vitest Project');
      expect(prismaMock.project.create).toHaveBeenCalledOnce();
      expect(prismaMock.project_Group.create).toHaveBeenCalledOnce(); // Verifies creator is made Admin
    });

    it('should block standard users from creating projects (403)', async () => {
      setAuthRole('STANDARD_USER');

      const res = await request(app)
        .post('/api/projects')
        .set('Cookie', ['token=fake-token'])
        .send({ name: 'Illegal Project' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('ONLY GLOBAL ADMINS CAN CREATE PROJECTS');
    });
  });

  // 2. GET /api/projects (Get All Projects)
  describe('GET /api/projects', () => {
    it('should return all projects for Global Admin', async () => {
      setAuthRole('GLOBAL_ADMIN');
      prismaMock.project.findMany.mockResolvedValue([mockProject]);

      const res = await request(app)
        .get('/api/projects')
        .set('Cookie', ['token=fake-token']);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(1);
      expect(prismaMock.project.findMany).toHaveBeenCalledOnce();
    });

    it('should return only assigned projects for standard users', async () => {
      setAuthRole('STANDARD_USER');
      // Mock the include: { project: true } structure
      prismaMock.project_Group.findMany.mockResolvedValue([
        { project: mockProject } as unknown as Project_Group,
      ]);

      const res = await request(app)
        .get('/api/projects')
        .set('Cookie', ['token=fake-token']);

      expect(res.status).toBe(200);
      expect(res.body[0].name).toBe('Vitest Project');
      expect(prismaMock.project_Group.findMany).toHaveBeenCalledOnce();
    });
  });

  // 3. GET /api/projects/:projectId (Get Single)
  describe('GET /api/projects/:projectId', () => {
    it('should return project details for a Project Viewer (200)', async () => {
      setAuthRole('STANDARD_USER');
      setProjectRole('PROJECT_VIEWER'); // checkAccess allows Viewer
      prismaMock.project.findUnique.mockResolvedValue(mockProject);
      const res = await request(app)
        .get(`/api/projects/${mockProjectId}`)
        .set('Cookie', ['token=fake-token']);
      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Vitest Project');
      expect(res.body.isCurrentUserAdmin).toBe(false);
    });

    it('should return project details and admin flag for a Project Admin (200)', async () => {
      setAuthRole('STANDARD_USER');
      setProjectRole('PROJECT_ADMIN'); // Second call to findUnique determines isCurrentUserAdmin
      prismaMock.project.findUnique.mockResolvedValue(mockProject);

      const res = await request(app)
        .get(`/api/projects/${mockProjectId}`)
        .set('Cookie', ['token=fake-token']);

      expect(res.status).toBe(200);
      expect(res.body.isCurrentUserAdmin).toBe(true);
    });

    it('should block non-members (403)', async () => {
      setAuthRole('STANDARD_USER');
      setProjectRole(null); // User not in project

      const res = await request(app)
        .get(`/api/projects/${mockProjectId}`)
        .set('Cookie', ['token=fake-token']);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('ACCESS DENIED');
    });
  });

  // 4. PATCH /api/projects/:projectId (Update)
  describe('PATCH /api/projects/:projectId', () => {
    it('should allow Project Admin to update details and notify others (200)', async () => {
      setAuthRole('STANDARD_USER');
      setProjectRole('PROJECT_ADMIN'); // checkAccess & admin check

      prismaMock.project.update.mockResolvedValue({
        ...mockProject,
        name: 'Updated Name',
      });
      // Mock other members in the project for notifications
      prismaMock.project_Group.findMany.mockResolvedValue([
        { userId: 'other-user' } as Project_Group,
      ]);

      const res = await request(app)
        .patch(`/api/projects/${mockProjectId}`)
        .set('Cookie', ['token=fake-token'])
        .send({ name: 'Updated Name' });

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Updated Name');
      expect(prismaMock.notification.createMany).toHaveBeenCalledOnce(); // Verified notifications sent
    });

    it('should block Project Members from updating (403)', async () => {
      setAuthRole('STANDARD_USER');
      setProjectRole('PROJECT_MEMBER'); // Insufficient permissions

      const res = await request(app)
        .patch(`/api/projects/${mockProjectId}`)
        .set('Cookie', ['token=fake-token'])
        .send({ name: 'Updated Name' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('ONLY ADMINS CAN EDIT PROJECT DETAILS');
    });
  });

  // 5. POST /api/projects/:projectId/assign (Assign Roles)
  describe('POST /api/projects/:projectId/assign', () => {
    it('should allow Project Admin to assign a role to another user (200)', async () => {
      setAuthRole('STANDARD_USER');
      setProjectRole('PROJECT_ADMIN');

      prismaMock.project.findUnique.mockResolvedValue(mockProject);
      prismaMock.project_Group.upsert.mockResolvedValue({} as Project_Group);

      const res = await request(app)
        .post(`/api/projects/${mockProjectId}/assign`)
        .set('Cookie', ['token=fake-token'])
        .send({ targetUserId: 'new-user-123', role: 'PROJECT_MEMBER' });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('USER ASSIGNED SUCCESSFULLY');
      expect(prismaMock.project_Group.upsert).toHaveBeenCalledOnce();
      expect(prismaMock.notification.create).toHaveBeenCalledOnce();
    });

    it('should prevent user from changing their own role (403)', async () => {
      setAuthRole('STANDARD_USER');

      const res = await request(app)
        .post(`/api/projects/${mockProjectId}/assign`)
        .set('Cookie', ['token=fake-token'])
        .send({ targetUserId: mockUserId, role: 'PROJECT_VIEWER' }); // Target is self

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('YOU CANNOT CHANGE YOUR OWN ROLE');
    });
    it('should allow Project Admin to change an existing members role (200)', async () => {
      setAuthRole('STANDARD_USER');
      setProjectRole('PROJECT_ADMIN');

      prismaMock.project.findUnique.mockResolvedValue({
        id: mockProjectId,
        name: 'Test Project',
      } as unknown as Project);

      prismaMock.project_Group.upsert.mockResolvedValue({
        userId: 'user-existing',
        role: 'PROJECT_VIEWER',
      } as unknown as Project_Group);

      const res = await request(app)
        .post(`/api/projects/${mockProjectId}/assign`)
        .set('Cookie', ['token=fake-token'])
        .send({ targetUserId: 'user-existing', role: 'PROJECT_VIEWER' });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('USER ASSIGNED SUCCESSFULLY');
      expect(prismaMock.notification.create).toHaveBeenCalled();
    });
  });
  // 6. PATCH /archive & /unarchive
  describe('Archive / Unarchive', () => {
    it('should allow Global Admin to archive project (200)', async () => {
      setAuthRole('GLOBAL_ADMIN');
      prismaMock.project.update.mockResolvedValue({
        ...mockProject,
        isArchived: true,
      });
      const res = await request(app)
        .patch(`/api/projects/${mockProjectId}/archive`)
        .set('Cookie', ['token=fake-token']);
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('PROJECT ARCHIVED SUCCESSFULLY');
      expect(res.body.project.isArchived).toBe(true);
    });
    it('should block Project Admins from archiving (403)', async () => {
      setAuthRole('STANDARD_USER'); // Even if they are Project Admin, Archive requires Global
      const res = await request(app)
        .patch(`/api/projects/${mockProjectId}/archive`)
        .set('Cookie', ['token=fake-token']);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('ONLY GLOBAL ADMINS CAN ARCHIVE PROJECTS');
    });
    it('should allow Global Admin to unarchive a project (200)', async () => {
      setAuthRole('GLOBAL_ADMIN');
      prismaMock.project.update.mockResolvedValue({
        id: mockProjectId,
        isArchived: false,
      } as unknown as Project);

      const res = await request(app)
        .patch(`/api/projects/${mockProjectId}/unarchive`)
        .set('Cookie', ['token=fake-token']);

      expect(res.status).toBe(200);
      expect(res.body.project.isArchived).toBe(false);
    });
  });

  // 7. PATCH /api/projects/:projectId/workflow
  describe('PATCH /api/projects/:projectId/workflow', () => {
    it('should update workflow if user is Project Admin (200)', async () => {
      setAuthRole('STANDARD_USER');
      setProjectRole('PROJECT_ADMIN');

      const mockWorkflow = { 'col-1': ['col-2'] };
      prismaMock.project.update.mockResolvedValue({
        ...mockProject,
        workflow: mockWorkflow,
      });
      const res = await request(app)
        .patch(`/api/projects/${mockProjectId}/workflow`)
        .set('Cookie', ['token=fake-token'])
        .send({ workflow: mockWorkflow });
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('WORKFLOW UPDATED');
      expect(prismaMock.project.update).toHaveBeenCalledWith({
        where: { id: mockProjectId },
        data: { workflow: mockWorkflow },
      });
    });
  });
  // 8. GET /api/projects/:projectId/members
  describe('GET /api/projects/:projectId/members', () => {
    it('should return a list of members for a specific project (200)', async () => {
      setAuthRole('STANDARD_USER');
      // Endpoint doesn't have internal checkAccess, it relies on route validation
      prismaMock.project_Group.findMany.mockResolvedValue([
        { userId: 'user-1', role: 'PROJECT_ADMIN' } as unknown as Project_Group,
        {
          userId: 'user-2',
          role: 'PROJECT_MEMBER',
        } as unknown as Project_Group,
      ]);
      const res = await request(app)
        .get(`/api/projects/${mockProjectId}/members`)
        .set('Cookie', ['token=fake-token']);
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].userId).toBe('user-1');
      expect(res.body[0].role).toBe('PROJECT_ADMIN');
      // Verify correct Prisma query params
      expect(prismaMock.project_Group.findMany).toHaveBeenCalledWith({
        where: { projectId: mockProjectId },
        select: { userId: true, role: true },
      });
    });
  });
});
