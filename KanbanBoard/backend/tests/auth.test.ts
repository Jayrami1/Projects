import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockDeep, mockReset, DeepMockProxy } from 'vitest-mock-extended';
import { PrismaClient, RefreshToken } from '@prisma/client';

//MOCK PRISMA FIRST (Vitest hoists this to the top)
vi.mock('../src/prisma', () => ({
  default: mockDeep<PrismaClient>(),
}));

// MOCK BCRYPT (Speeds up tests significantly)
vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('mocked_hashed_password'),
    compare: vi.fn(),
  },
}));
import request from 'supertest';
import app from '../src/index';
import prisma from '../src/prisma';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

describe('Authentication API Endpoints', () => {
  beforeEach(() => {
    mockReset(prismaMock);
    vi.clearAllMocks();
  });
  const mockUser = {
    id: 'user-123',
    name: 'John Doe',
    email: 'john@test.com',
    user_password: 'mocked_hashed_password',
    avatarLink: null,
    isGLOBAL_ADMIN: false,
  };
  // 1. REGISTER TESTS
  describe('POST /api/auth/register', () => {
    it('should successfully register a new user (201)', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null); // Email not taken
      prismaMock.user.create.mockResolvedValue(mockUser);

      const res = await request(app).post('/api/auth/register').send({
        name: 'John Doe',
        email: 'john@test.com',
        user_password: 'Password123!',
      });

      expect(res.status).toBe(201);
      expect(res.body.message).toBe('User registered successfully');
      expect(res.body.userId).toBe('user-123');
      expect(prismaMock.user.create).toHaveBeenCalledOnce();
    });

    it('should fail if email is already in use (400)', async () => {
      prismaMock.user.findUnique.mockResolvedValue(mockUser); // Email IS taken

      const res = await request(app).post('/api/auth/register').send({
        name: 'Another John',
        email: 'john@test.com',
        user_password: 'Password123!',
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('User already exists');
      expect(prismaMock.user.create).not.toHaveBeenCalled();
    });
  });

  // 2. LOGIN TESTS
  describe('POST /api/auth/login', () => {
    it('should login successfully, return tokens, and set cookie (200)', async () => {
      prismaMock.user.findUnique.mockResolvedValue(mockUser);

      // Force bcrypt to simulate a matching password
      vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

      // Mock the DB saving the refresh token
      prismaMock.refreshToken.create.mockResolvedValue({
        id: 'token-123',
        token: 'fake-refresh-token',
        userId: 'user-123',
        createdAt: new Date(),
        expiresAt: new Date(),
      });

      const res = await request(app).post('/api/auth/login').send({
        email: 'john@test.com',
        user_password: 'Password123!',
      });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Login successful');
      expect(res.body.refreshToken).toBeDefined();
      expect(res.body.user.id).toBe('user-123');

      // Verify the HTTP-Only Cookie was set
      expect(res.headers['set-cookie']).toBeDefined();
      expect(res.headers['set-cookie'][0]).toMatch(/token=eyJ/); // Starts with JWT signature
    });

    it('should fail with invalid email (401)', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null); // User not found
      const res = await request(app).post('/api/auth/login').send({
        email: 'wrong@test.com',
        user_password: 'Password123!',
      });
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid email or password');
    });
    it('should fail with incorrect password (401)', async () => {
      prismaMock.user.findUnique.mockResolvedValue(mockUser);
      // Force bcrypt to simulate a WRONG password
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);
      const res = await request(app).post('/api/auth/login').send({
        email: 'john@test.com',
        user_password: 'WrongPassword!',
      });
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid email or password');
    });
  });

  // 3. REFRESH TOKEN TESTS
  describe('POST /api/auth/refresh', () => {
    it('should issue a new access token if refresh token is valid (200)', async () => {
      // Generate a real refresh token for the test
      const validRefreshToken = jwt.sign(
        { userId: 'user-123', type: 'refresh' },
        process.env.JWT_SECRET || 'super_secret_key'
      );

      // Mock the DB finding the token
      const mockTokenRecord = {
        id: 'token-123',
        token: validRefreshToken,
        userId: 'user-123',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + 100000), // Future date
        user: mockUser,
      };

      prismaMock.refreshToken.findFirst.mockResolvedValue(
        mockTokenRecord as unknown as RefreshToken
      );
      const res = await request(app).post('/api/auth/refresh').send({
        refreshToken: validRefreshToken,
      });

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Token refreshed successfully');

      // Verify a new cookie was set
      expect(res.headers['set-cookie']).toBeDefined();
    });

    it('should fail if no refresh token is provided (401)', async () => {
      const res = await request(app).post('/api/auth/refresh').send({});
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Refresh token required');
    });

    it('should fail if refresh token is revoked/not in DB (401)', async () => {
      const validRefreshToken = jwt.sign(
        { userId: 'user-123', type: 'refresh' },
        process.env.JWT_SECRET || 'super_secret_key'
      );

      // Token is not in the database (e.g., logged out)
      prismaMock.refreshToken.findFirst.mockResolvedValue(null);

      const res = await request(app).post('/api/auth/refresh').send({
        refreshToken: validRefreshToken,
      });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Refresh token revoked or expired');
    });
  });

  // 4. LOGOUT TESTS
  describe('POST /api/auth/logout', () => {
    it('should clear cookies and delete refresh token from DB (200)', async () => {
      prismaMock.refreshToken.deleteMany.mockResolvedValue({ count: 1 });
      const res = await request(app).post('/api/auth/logout').send({
        refreshToken: 'some-refresh-token',
      });
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Logged out successfully');
      expect(prismaMock.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { token: 'some-refresh-token' },
      });
      expect(res.headers['set-cookie'][0]).toContain('token=;');
    });
  });
});
