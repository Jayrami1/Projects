import { Request, Response, NextFunction } from 'express';

export const globalErrorHandler = (
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
): void => {
  // eslint-disable-next-line no-console
  if (process.env.NODE_ENV !== 'test')
    console.error(
      `[Global Error Handler]: ${err instanceof Error ? err.message : err}`
    );

  // Handle specific RBAC string errors thrown by checkAccess
  if (err instanceof Error) {
    if (err.message === 'INSUFFICIENT_PERMISSIONS') {
      res
        .status(403)
        .json({ error: 'FORBIDDEN: Your role does not allow this action.' });
      return;
    }

    if (err.message === 'NOT_IN_PROJECT') {
      res.status(403).json({
        error: 'ACCESS DENIED: You are not a member of this project.',
      });
      return;
    }
    if (err.message === 'PROJECT_ARCHIVED') {
      res
        .status(403)
        .json({
          error:
            'ACCESS DENIED: Project is archived. Unarchive it to make changes.',
        });
      return;
    }
  }

  // Handle Prisma specific errors safely
  const prismaError = err as { code?: string };
  if (prismaError?.code === 'P2025') {
    res.status(404).json({ error: 'RECORD NOT FOUND IN DATABASE' });
    return;
  }

  // Default Fallback
  res.status(500).json({ error: 'INTERNAL SERVER ERROR' });
};
