import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_key';

// Extend the Express Request type to include user data
export interface AuthRequest extends Request {
  user?: {
    userId: string;
    isGlobalAdmin: boolean;
  };
}

export const authenticate = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  // Get token from cookies
  const token = req.cookies?.token;
  if (!token) {
    res.status(401).json({ error: 'Authentication required. Please log in.' });
    return;
  }
  try {
    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET) as {
      userId: string;
      isGlobalAdmin: boolean;
    };
    // Attach user data to request
    req.user = {
      userId: decoded.userId,
      isGlobalAdmin: decoded.isGlobalAdmin,
    };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token.' });
  }
};
