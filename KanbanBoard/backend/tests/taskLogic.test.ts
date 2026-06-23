import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockDeep, mockReset, DeepMockProxy } from 'vitest-mock-extended';
import { PrismaClient, Prisma, Task } from '@prisma/client';
import { syncStoryStatus } from '../src/controllers/task';

vi.mock('../src/prisma', () => ({
  default: mockDeep<PrismaClient>(),
}));

import prisma from '../src/prisma';
const prismaMock = prisma as unknown as DeepMockProxy<PrismaClient>;

describe('Unit Logic: Story Status Synchronization', () => {
  const mockStoryId = 'story-unit-123';

  beforeEach(() => {
    mockReset(prismaMock);
  });

  it('should revert a Story to TO_DO if it has no subtasks', async () => {
    prismaMock.task.findUnique.mockResolvedValue({
      id: mockStoryId,
      type: 'STORY',
      status: 'DONE',
      subtasks: [],
    } as unknown as Task);

    await syncStoryStatus(
      mockStoryId,
      prismaMock as unknown as Prisma.TransactionClient
    );

    expect(prismaMock.task.update).toHaveBeenCalledWith({
      where: { id: mockStoryId },
      data: expect.objectContaining({
        status: 'TO_DO',
        resolvedAt: null,
        closedAt: null,
      }),
    });
  });

  it('should set Story to DONE when all subtasks are DONE', async () => {
    prismaMock.task.findUnique.mockResolvedValue({
      id: mockStoryId,
      type: 'STORY',
      status: 'IN_PROGRESS',
      subtasks: [
        { id: 's1', status: 'DONE' },
        { id: 's2', status: 'DONE' },
      ],
    } as unknown as Task);
    await syncStoryStatus(
      mockStoryId,
      prismaMock as unknown as Prisma.TransactionClient
    );
    expect(prismaMock.task.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'DONE' }),
      })
    );
  });
});
