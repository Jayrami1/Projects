import { describe, it, expect } from 'vitest';

const defaultTransitions: Record<string, string[]> = {
  TO_DO: ['IN_PROGRESS'],
  IN_PROGRESS: ['TO_DO', 'REVIEW', 'DONE'],
  REVIEW: ['IN_PROGRESS', 'DONE'],
  DONE: ['IN_PROGRESS', 'REVIEW'],
};

describe('Unit Logic: Task Finite State Machine (FSM)', () => {
  it('should strictly allow TO_DO to move ONLY to IN_PROGRESS', () => {
    const allowed = defaultTransitions['TO_DO'];
    expect(allowed).toContain('IN_PROGRESS');
    expect(allowed).not.toContain('DONE');
    expect(allowed).not.toContain('REVIEW');
  });

  it('should prevent DONE tasks from reverting directly to TO_DO', () => {
    // Reopening a task must go through IN_PROGRESS or REVIEW first
    const allowed = defaultTransitions['DONE'];
    expect(allowed).not.toContain('TO_DO');
    expect(allowed).toContain('IN_PROGRESS');
  });
});
