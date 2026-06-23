import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { mockDeep, mockReset, DeepMockProxy } from 'vitest-mock-extended';
import {
  PrismaClient,
  Prisma,
  Task,
  Column,
  Project_Group,
  AuditLog,
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

describe('Task API Endpoints', () => {
  const mockUserId = 'user-123';
  const mockProjectId = 'proj-123';
  const mockColId = 'col-123';
  const mockTaskId = 'task-123';
  const mockStoryId = 'story-123';

  beforeEach(() => {
    mockReset(prismaMock);
    vi.clearAllMocks();

    // Safely execute Prisma transactions for create, update, delete, and reorder
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

  // 1. POST /api/tasks/column/:colId (Create)
  describe('POST /api/tasks/column/:colId', () => {
    it('should create a task successfully if WIP limit is not exceeded (201)', async () => {
      setAuthRole();
      setProjectMember('PROJECT_MEMBER');

      // Mock column lookup to check WIP limits
      prismaMock.column.findUnique.mockResolvedValue({
        id: mockColId,
        board: { projectId: mockProjectId },
        wipLimit: 5,
        cStatus: 'TO_DO',
        _count: { tasks: 2 }, // 2 < 5, so creation is allowed
      } as unknown as Column);

      prismaMock.task.create.mockResolvedValue({
        id: mockTaskId,
        title: 'New Task',
      } as Task);

      const res = await request(app)
        .post(`/api/tasks/column/${mockColId}`)
        .set('Cookie', ['token=fake-token'])
        .send({ title: 'New Task', description: 'Testing creation' });

      expect(res.status).toBe(201);
      expect(res.body.title).toBe('New Task');
      expect(prismaMock.task.create).toHaveBeenCalledOnce();
    });

    it('should block task creation if WIP Limit is exceeded (400)', async () => {
      setAuthRole();
      setProjectMember('PROJECT_MEMBER');

      prismaMock.column.findUnique.mockResolvedValue({
        id: mockColId,
        board: { projectId: mockProjectId },
        wipLimit: 3,
        cStatus: 'TO_DO',
        _count: { tasks: 3 }, // 3 == 3, limit reached
      } as unknown as Column);

      const res = await request(app)
        .post(`/api/tasks/column/${mockColId}`)
        .set('Cookie', ['token=fake-token'])
        .send({ title: 'Overflow Task' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('WIP LIMIT EXCEEDED');
      expect(prismaMock.task.create).not.toHaveBeenCalled();
    });

    it('should return 400 if title is missing', async () => {
      setAuthRole();
      const res = await request(app)
        .post(`/api/tasks/column/${mockColId}`)
        .set('Cookie', ['token=fake-token'])
        .send({ description: 'No title provided' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('TASK TITLE REQUIRED');
    });
  });

  // 2. GET /api/tasks/:taskId (Read)
  describe('GET /api/tasks/:taskId', () => {
    it('should fetch task details for viewers (200)', async () => {
      setAuthRole();
      setProjectMember('PROJECT_VIEWER'); // Viewers can read

      prismaMock.task.findUnique.mockResolvedValue({
        id: mockTaskId,
        title: 'Existing Task',
        column: { board: { projectId: mockProjectId } },
      } as unknown as Task);

      const res = await request(app)
        .get(`/api/tasks/${mockTaskId}`)
        .set('Cookie', ['token=fake-token']);

      expect(res.status).toBe(200);
      expect(res.body.title).toBe('Existing Task');
    });

    it('should return 404 if task does not exist', async () => {
      setAuthRole();
      prismaMock.task.findUnique.mockResolvedValue(null);

      const res = await request(app)
        .get('/api/tasks/fake-id')
        .set('Cookie', ['token=fake-token']);

      expect(res.status).toBe(404);
    });
    it('should resolve projectId from subtasks if a Story is in the backlog (200)', async () => {
      setAuthRole();
      setProjectMember('PROJECT_VIEWER');

      const backlogStory = {
        id: mockStoryId,
        type: 'STORY',
        columnId: null,
        subtasks: [{ id: 'sub-1' }],
      } as unknown as Task;
      prismaMock.task.findUnique.mockResolvedValueOnce(backlogStory);
      prismaMock.task.findUnique.mockResolvedValueOnce({
        id: 'sub-1',
        column: { board: { projectId: mockProjectId } },
      } as unknown as Task);
      const res = await request(app)
        .get(`/api/tasks/${mockStoryId}`)
        .set('Cookie', ['token=fake-token']);
      expect(res.status).toBe(200);
    });
  });

  // 3. PATCH /api/tasks/:taskId (Update)
  describe('PATCH /api/tasks/:taskId', () => {
    const mockExistingTask = {
      id: mockTaskId,
      title: 'Old Title',
      status: 'TO_DO',
      assigneeId: mockUserId, // Assigned to current user
      type: 'TASK',
      columnId: mockColId,
      column: { board: { projectId: mockProjectId } },
      subtasks: [],
    } as unknown as Task;

    it('should allow valid status transitions (TO_DO -> IN_PROGRESS)', async () => {
      setAuthRole();
      setProjectMember('PROJECT_MEMBER');

      prismaMock.task.findUnique.mockResolvedValue(mockExistingTask);
      prismaMock.task.update.mockResolvedValue({
        ...mockExistingTask,
        status: 'IN_PROGRESS',
      } as unknown as Task);

      const res = await request(app)
        .patch(`/api/tasks/${mockTaskId}`)
        .set('Cookie', ['token=fake-token'])
        .send({ status: 'IN_PROGRESS' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('IN_PROGRESS');
      expect(prismaMock.auditLog.create).toHaveBeenCalled(); // Audit logged
    });

    it('should block invalid status transitions (TO_DO -> DONE) (400)', async () => {
      setAuthRole();
      setProjectMember('PROJECT_MEMBER');

      prismaMock.task.findUnique.mockResolvedValue(mockExistingTask); // Currently TO_DO

      const res = await request(app)
        .patch(`/api/tasks/${mockTaskId}`)
        .set('Cookie', ['token=fake-token'])
        .send({ status: 'DONE' }); // FSM blocks this

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('INVALID_STATUS_TRANSITION');
    });

    it('should prevent non-admins from changing admin-only fields (403)', async () => {
      setAuthRole();
      setProjectMember('PROJECT_MEMBER'); // Not an admin

      prismaMock.task.findUnique.mockResolvedValue(mockExistingTask);

      const res = await request(app)
        .patch(`/api/tasks/${mockTaskId}`)
        .set('Cookie', ['token=fake-token'])
        .send({ priority: 'CRITICAL', title: 'Hacked Title' }); // Admin fields

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('ONLY ADMINS CAN CHANGE');
    });

    it('should allow Admins to change admin-only fields (200)', async () => {
      setAuthRole();
      setProjectMember('PROJECT_ADMIN'); // IS an admin

      prismaMock.task.findUnique.mockResolvedValue(mockExistingTask);
      prismaMock.task.update.mockResolvedValue({
        ...mockExistingTask,
        priority: 'CRITICAL',
      } as unknown as Task);
      prismaMock.project_Group.findMany.mockResolvedValue([]); // Mock admins for notifications

      const res = await request(app)
        .patch(`/api/tasks/${mockTaskId}`)
        .set('Cookie', ['token=fake-token'])
        .send({ priority: 'CRITICAL', title: 'Admin Updated Title' });

      expect(res.status).toBe(200);
    });

    it('should block manual status changes to STORY tasks (403)', async () => {
      setAuthRole();
      setProjectMember('PROJECT_MEMBER');

      prismaMock.task.findUnique.mockResolvedValue({
        ...mockExistingTask,
        type: 'STORY',
      } as unknown as Task);

      const res = await request(app)
        .patch(`/api/tasks/${mockTaskId}`)
        .set('Cookie', ['token=fake-token'])
        .send({ status: 'IN_PROGRESS' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('STORY STATUS CANNOT BE CHANGED MANUALLY'); // Stories auto-derive status
    });
    it('should generate an automated Audit Log entry when a task status is updated (200)', async () => {
      setAuthRole();
      setProjectMember('PROJECT_MEMBER');
      const mockTask = {
        id: mockTaskId,
        status: 'TO_DO',
        column: {
          board: {
            projectId: mockProjectId,
            project: { workflow: null }, // Ensures defaultTransitions are used
          },
        },
      } as unknown as Task;

      prismaMock.task.findUnique.mockResolvedValue(mockTask);
      prismaMock.task.update.mockResolvedValue({
        ...mockTask,
        status: 'IN_PROGRESS',
      } as unknown as Task);
      const mockAuditRecord = {
        id: 'log-123',
        action: 'STATUS_CHANGE',
        oldValue: 'TO_DO',
        newValue: 'IN_PROGRESS',
        issueId: mockTaskId,
        userId: mockUserId,
        timestamp: new Date(),
      } as unknown as AuditLog;
      prismaMock.auditLog.create.mockResolvedValue(mockAuditRecord);
      const res = await request(app)
        .patch(`/api/tasks/${mockTaskId}`)
        .set('Cookie', ['token=fake-token'])
        .send({ status: 'IN_PROGRESS' });

      expect(res.status).toBe(200);
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'STATUS_CHANGE',
            issueId: mockTaskId,
            oldValue: 'TO_DO',
            newValue: 'IN_PROGRESS',
          }),
        })
      );
    });
    it('should perform smart routing to the first available column when status is changed (200)', async () => {
      setAuthRole();
      setProjectMember('PROJECT_MEMBER');
      const mockTask = {
        id: mockTaskId,
        status: 'TO_DO',
        columnId: 'col-todo',
        column: { boardId: 'board-1', board: { projectId: mockProjectId } },
      } as unknown as Task;
      prismaMock.task.findUnique.mockResolvedValue(mockTask);
      //Mock finding candidate columns for status 'IN_PROGRESS'
      prismaMock.column.findMany.mockResolvedValue([
        {
          id: 'col-full',
          wipLimit: 1,
          _count: { tasks: 1 },
          cStatus: 'IN_PROGRESS',
        },
        {
          id: 'col-available',
          wipLimit: 5,
          _count: { tasks: 2 },
          cStatus: 'IN_PROGRESS',
        },
      ] as unknown as Column[]);

      //Mock the WIP limit enforcement check for the target column
      prismaMock.column.findUnique.mockResolvedValue({
        id: 'col-available',
        wipLimit: 5,
        _count: { tasks: 2 },
      } as unknown as Column);
      prismaMock.task.update.mockResolvedValue({
        ...mockTask,
        status: 'IN_PROGRESS',
        columnId: 'col-available',
      } as unknown as Task);
      const res = await request(app)
        .patch(`/api/tasks/${mockTaskId}`)
        .set('Cookie', ['token=fake-token'])
        .send({ status: 'IN_PROGRESS' });

      expect(res.status).toBe(200);
      expect(res.body.columnId).toBe('col-available');
    });
    it('should reset closedAt and resolvedAt when a DONE task is reopened to IN_PROGRESS (200)', async () => {
      setAuthRole();
      setProjectMember('PROJECT_MEMBER');
      const doneTask = {
        id: mockTaskId,
        status: 'DONE',
        closedAt: new Date(),
        column: { board: { projectId: mockProjectId } },
      } as unknown as Task;

      prismaMock.task.findUnique.mockResolvedValue(doneTask);
      prismaMock.task.update.mockResolvedValue({
        ...doneTask,
        status: 'IN_PROGRESS',
        closedAt: null,
      } as unknown as Task);
      const res = await request(app)
        .patch(`/api/tasks/${mockTaskId}`)
        .set('Cookie', ['token=fake-token'])
        .send({ status: 'IN_PROGRESS' });

      expect(res.status).toBe(200);
      // Verify the update call explicitly nullifies the timestamps
      expect(prismaMock.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ closedAt: null, resolvedAt: null }),
        })
      );
    });

    it('should resolve projectId from subtasks if a Story is in the backlog (200)', async () => {
      setAuthRole();
      setProjectMember('PROJECT_VIEWER');

      // Story has no column (Backlog entry)
      const backlogStory = {
        id: mockStoryId,
        type: 'STORY',
        columnId: null,
        subtasks: [{ id: 'sub-1' }],
      } as unknown as Task;

      prismaMock.task.findUnique.mockResolvedValueOnce(backlogStory); // Find Story
      prismaMock.task.findUnique.mockResolvedValueOnce({
        //Resolve Project via Subtask
        id: 'sub-1',
        column: { board: { projectId: mockProjectId } },
      } as unknown as Task);

      const res = await request(app)
        .get(`/api/tasks/${mockStoryId}`)
        .set('Cookie', ['token=fake-token']);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(mockStoryId);
    });
    it('should block manual status changes to STORY tasks even if subtasks are not DONE (403)', async () => {
      setAuthRole();
      setProjectMember('PROJECT_MEMBER');
      prismaMock.task.findUnique.mockResolvedValue({
        id: mockStoryId,
        type: 'STORY',
        status: 'IN_PROGRESS',
        subtasks: [{ status: 'IN_PROGRESS' }],
        column: { board: { projectId: mockProjectId } },
      } as unknown as Task);

      const res = await request(app)
        .patch(`/api/tasks/${mockStoryId}`)
        .set('Cookie', ['token=fake-token'])
        .send({ status: 'DONE' });
      // controller prioritizes the "STORY STATUS CANNOT BE CHANGED MANUALLY" check
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('STORY STATUS CANNOT BE CHANGED MANUALLY');
    });
  });

  // 4. PATCH /api/tasks/reorder (Reorder)
  describe('PATCH /api/tasks/reorder', () => {
    it('should fail if a non-admin tries to move a task assigned to someone else (403)', async () => {
      setAuthRole();
      setProjectMember('PROJECT_MEMBER');

      // Task is assigned to a DIFFERENT user
      prismaMock.task.findUnique.mockResolvedValue({
        id: mockTaskId,
        column: { board: { projectId: mockProjectId } },
      } as unknown as Task);

      prismaMock.task.findMany.mockResolvedValue([
        {
          id: mockTaskId,
          assigneeId: 'different-user',
          title: 'Not Mine',
        } as Task,
      ]);
      const res = await request(app)
        .patch('/api/tasks/reorder')
        .set('Cookie', ['token=fake-token'])
        .send({ tasks: [{ id: mockTaskId, order: 2, columnId: mockColId }] });
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('FORBIDDEN');
      expect(res.body.message).toContain('assigned to someone else'); // Reorder block
    });
    it('should reorder tasks within the SAME column (200)', async () => {
      setAuthRole();
      setProjectMember('PROJECT_MEMBER');

      prismaMock.task.findUnique.mockResolvedValue({
        id: 'task-1',
        column: { board: { projectId: mockProjectId } },
      } as unknown as Task);

      prismaMock.task.findMany.mockResolvedValue([
        {
          id: 'task-1',
          columnId: mockColId,
          title: 'T1',
          assigneeId: mockUserId,
        },
      ] as unknown as Task[]);

      // Mock finding project members for notifications
      prismaMock.project_Group.findMany.mockResolvedValue(
        [] as Project_Group[]
      );

      const res = await request(app)
        .patch('/api/tasks/reorder')
        .set('Cookie', ['token=fake-token'])
        .send({ tasks: [{ id: 'task-1', order: 5, columnId: mockColId }] });

      expect(res.status).toBe(200);
      expect(prismaMock.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ order: 5 }), // Verifies it just updates the order
        })
      );
    });

    it('should block reorder if custom workflow is violated (400)', async () => {
      setAuthRole();
      setProjectMember('PROJECT_MEMBER');

      // Define a custom workflow restricting movement
      const mockWorkflow = { 'col-todo': ['col-progress'] };

      prismaMock.task.findUnique.mockResolvedValue({
        id: 't1',
        column: { board: { projectId: mockProjectId } },
      } as unknown as Task);

      prismaMock.task.findMany.mockResolvedValue([
        {
          id: 't1',
          columnId: 'col-todo',
          assigneeId: mockUserId,
          column: { board: { project: { workflow: mockWorkflow } } },
        },
      ] as unknown as Task[]);

      prismaMock.column.findUnique.mockResolvedValue({
        id: 'col-done',
        cStatus: 'DONE',
        name: 'Done',
      } as unknown as Column);

      const res = await request(app)
        .patch('/api/tasks/reorder')
        .set('Cookie', ['token=fake-token'])
        .send({ tasks: [{ id: 't1', order: 1, columnId: 'col-done' }] });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('not permitted by custom workflow');
    });
  });

  // 5. DELETE /api/tasks/:taskId (Delete)
  describe('DELETE /api/tasks/:taskId', () => {
    it('should delete task successfully for project members (200)', async () => {
      setAuthRole();
      setProjectMember('PROJECT_MEMBER');
      prismaMock.task.findUnique.mockResolvedValue({
        id: mockTaskId,
        column: { board: { projectId: mockProjectId } },
      } as unknown as Task);
      prismaMock.task.delete.mockResolvedValue({ id: mockTaskId } as Task);
      const res = await request(app)
        .delete(`/api/tasks/${mockTaskId}`)
        .set('Cookie', ['token=fake-token']);
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('TASK DELETED SUCCESSFULLY');
      expect(prismaMock.task.delete).toHaveBeenCalledOnce();
    });
    it('should revert parent Story to TO_DO if its last subtask is deleted (200)', async () => {
      setAuthRole();
      setProjectMember('PROJECT_MEMBER');

      const subtask = {
        id: 'sub-1',
        parentId: mockStoryId,
        column: { board: { projectId: mockProjectId } },
      } as unknown as Task;

      prismaMock.task.findUnique.mockResolvedValueOnce(subtask);

      // Mock the parent lookup inside syncStoryStatus
      prismaMock.task.findUnique.mockResolvedValueOnce({
        id: mockStoryId,
        type: 'STORY',
        status: 'IN_PROGRESS',
        subtasks: [], // Now empty after deletion simulation
      } as unknown as Task);

      const res = await request(app)
        .delete(`/api/tasks/sub-1`)
        .set('Cookie', ['token=fake-token']);

      expect(res.status).toBe(200);
      // Verify parent update to TO_DO was triggered
      expect(prismaMock.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockStoryId },
          data: expect.objectContaining({ status: 'TO_DO' }),
        })
      );
    });
  });
});
