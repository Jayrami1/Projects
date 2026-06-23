import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { mockDeep, mockReset, DeepMockProxy } from 'vitest-mock-extended';
import { PrismaClient, User, Project_Group } from '@prisma/client';
import fs from 'fs';
import bcrypt from 'bcrypt';

vi.mock('../src/prisma', () => ({
  default: mockDeep<PrismaClient>(),
}));
vi.mock('jsonwebtoken');

// Mock bcrypt to control password verification
vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('new_hashed_password'),
    compare: vi.fn(),
  },
}));

// Mock the File System to prevent actual file creation during the avatar upload test
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn().mockReturnValue(true),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
  },
}));

import request from 'supertest';
import app from '../src/index';
import prisma from '../src/prisma';
import jwt from 'jsonwebtoken';

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

describe('User API Endpoints', () => {
  const mockUserId = 'user-123';
  const mockProjectId = 'proj-123';

  beforeEach(() => {
    mockReset(prismaMock);
    vi.clearAllMocks();
  });

  const setAuthRole = (
    role: 'GLOBAL_ADMIN' | 'STANDARD_USER' = 'STANDARD_USER',
    userId = mockUserId
  ) => {
    (jwt.verify as unknown as Mock).mockReturnValue({
      userId,
      isGlobalAdmin: role === 'GLOBAL_ADMIN',
    } as unknown as jwt.JwtPayload);
  };

  // 1. GET /api/users/profile
  describe('GET /api/users/profile', () => {
    it('should return the logged-in user profile without leaking the password (200)', async () => {
      setAuthRole();

      prismaMock.user.findUnique.mockResolvedValue({
        id: mockUserId,
        name: 'Test User',
        email: 'test@test.com',
        avatarLink: '/uploads/avatars/test.png',
        isGLOBAL_ADMIN: false,
      } as User);

      const res = await request(app)
        .get('/api/users/profile')
        .set('Cookie', ['token=fake-token']);

      expect(res.status).toBe(200);
      expect(res.body.name).toBe('Test User');
      expect(res.body.user_password).toBeUndefined(); // Security check!
    });

    it('should return 404 if the user profile cannot be found in the database', async () => {
      setAuthRole();
      prismaMock.user.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .get('/api/users/profile')
        .set('Cookie', ['token=fake-token']);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('USER NOT FOUND');
    });
  });

  // 2. PATCH /api/users/profile
  describe('PATCH /api/users/profile', () => {
    it('should update name and email without processing an avatar (200)', async () => {
      setAuthRole();
      prismaMock.user.update.mockResolvedValue({
        id: mockUserId,
        name: 'Updated Name',
        email: 'updated@test.com',
      } as User);

      const res = await request(app)
        .patch('/api/users/profile')
        .set('Cookie', ['token=fake-token'])
        .send({ name: 'Updated Name', email: 'updated@test.com' });

      expect(res.status).toBe(200);
      expect(prismaMock.user.update).toHaveBeenCalledWith({
        where: { id: mockUserId },
        data: {
          name: 'Updated Name',
          email: 'updated@test.com',
          avatarLink: undefined,
        },
      });
      expect(fs.writeFileSync).not.toHaveBeenCalled(); // No file operations triggered
    });

    it('should parse base64 avatar, write to disk using mocked fs, and update DB (200)', async () => {
      setAuthRole();
      const fakeBase64 =
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
      prismaMock.user.update.mockResolvedValue({
        id: mockUserId,
        avatarLink: '/uploads/avatars/fake-image.png',
      } as User);
      const res = await request(app)
        .patch('/api/users/profile')
        .set('Cookie', ['token=fake-token'])
        .send({ avatar: fakeBase64 });

      expect(res.status).toBe(200);

      // Verify fs.writeFileSync mock intercepted the base64 conversion
      expect(fs.writeFileSync).toHaveBeenCalledOnce();

      // Verify Prisma received an avatarLink string representing the file path
      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            avatarLink: expect.stringContaining('/uploads/avatars/'),
          }),
        })
      );
    });
  });

  // 3. GET /api/users (List/Search Users)
  describe('GET /api/users', () => {
    it('should return all project members if projectId is provided (200)', async () => {
      setAuthRole();
      prismaMock.project_Group.findUnique.mockResolvedValue({
        userId: mockUserId,
        projectId: mockProjectId,
        role: 'PROJECT_VIEWER',
      } as Project_Group);
      prismaMock.project_Group.findMany.mockResolvedValue([
        {
          user: { id: 'member-1', name: 'Member One' },
        } as unknown as Project_Group,
      ]);
      const res = await request(app)
        .get(`/api/users?projectId=${mockProjectId}`)
        .set('Cookie', ['token=fake-token']);
      expect(res.status).toBe(200);
      expect(res.body[0].name).toBe('Member One');
    });

    //Tests the `checkProjectId` parameter added for Admins
    it('should return the full list of users for a Project Admin using checkProjectId (200)', async () => {
      setAuthRole();

      // RBAC Check: User MUST be an admin for the project they are checking
      prismaMock.project_Group.findUnique.mockResolvedValue({
        userId: mockUserId,
        projectId: mockProjectId,
        role: 'PROJECT_ADMIN',
      } as Project_Group);

      prismaMock.user.findMany.mockResolvedValue([
        { id: 'user-a', name: 'Alice' } as User,
        { id: 'user-b', name: 'Bob' } as User,
      ]);

      const res = await request(app)
        .get(`/api/users?checkProjectId=${mockProjectId}`)
        .set('Cookie', ['token=fake-token']);

      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].name).toBe('Alice');
      expect(prismaMock.user.findMany).toHaveBeenCalled();
    });

    it('should block non-admins from using the checkProjectId fetch (403)', async () => {
      setAuthRole();

      // User is only a Viewer, not an Admin
      prismaMock.project_Group.findUnique.mockResolvedValue({
        userId: mockUserId,
        projectId: mockProjectId,
        role: 'PROJECT_VIEWER',
      } as Project_Group);

      const res = await request(app)
        .get(`/api/users?checkProjectId=${mockProjectId}`)
        .set('Cookie', ['token=fake-token']);

      expect(res.status).toBe(403);
    });

    it('should block standard users from fetching the global list without params (403)', async () => {
      setAuthRole('STANDARD_USER');
      const res = await request(app)
        .get('/api/users')
        .set('Cookie', ['token=fake-token']);
      expect(res.status).toBe(403);
    });
  });

  // 4. PATCH /api/users/password
  describe('PATCH /api/users/password', () => {
    it('should change password if current password matches (200)', async () => {
      setAuthRole();

      prismaMock.user.findUnique.mockResolvedValue({
        id: mockUserId,
        user_password: 'old_hashed_password',
      } as User);

      // Force bcrypt to simulate a matching current password
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      prismaMock.user.update.mockResolvedValue({} as User);

      const res = await request(app)
        .patch('/api/users/password')
        .set('Cookie', ['token=fake-token'])
        .send({
          currentPassword: 'OldPassword123!',
          newPassword: 'NewPassword123!',
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Password Updated Successfully');

      // Verify bcrypt hash was called to encrypt the NEW password before saving
      expect(bcrypt.hash).toHaveBeenCalledWith('NewPassword123!', 10);
      expect(prismaMock.user.update).toHaveBeenCalledOnce();
    });

    it('should reject password change if current password is wrong (400)', async () => {
      setAuthRole();

      prismaMock.user.findUnique.mockResolvedValue({
        id: mockUserId,
        user_password: 'old_hashed',
      } as User);
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      const res = await request(app)
        .patch('/api/users/password')
        .set('Cookie', ['token=fake-token'])
        .send({
          currentPassword: 'WrongPassword!',
          newPassword: 'NewPassword123!',
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INCORRECT PASSWORD');
      expect(prismaMock.user.update).not.toHaveBeenCalled(); // Password safe
    });
  });
});
