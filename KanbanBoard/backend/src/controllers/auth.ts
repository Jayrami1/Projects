import { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import prisma from '../prisma';
import { async_catcher } from '../utility/catch';
import { error } from 'console';

// JWT_SECRET is storing the key into env file and not hardcoded in code or with a default to run code
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_key';

// Register is passed a fuction with return type voidand wrapped in async catcher for handling errors
export const register = async_catcher(
  async (req: Request, res: Response): Promise<void> => {
    const { name, email, user_password } = req.body;
    // Searches for existing user with same user email
    const existingUser = await prisma.user.findUnique({
      where: { email: email as string },
    });

    // If user exists then exits the function early with bad request code 400
    if (existingUser) {
      res.status(400).json({ error: 'User already exists' });
      return;
    }

    const saltRounds = 10; //Determines how many times hashing function is executed (doubles time each round)
    const hashedPassword = await bcrypt.hash(
      user_password as string,
      saltRounds
    ); //Hashing the password using bcrypt directly
    // New user creation with name email and hashed password
    const newUser = await prisma.user.create({
      data: {
        name: name as string,
        email: email as string,
        user_password: hashedPassword,
      },
    });

    // Created succesfully status code 201
    res
      .status(201)
      .json({ message: 'User registered successfully', userId: newUser.id });
  }
);
// Login setup
export const login = async_catcher(
  async (req: Request, res: Response): Promise<void> => {
    const { email, user_password } = req.body;

    // Finds user based on email
    const user = await prisma.user.findUnique({
      where: { email: email as string },
    });

    // No user then 401Unauthorised error
    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    // Matches the password entered with hash password
    const isMatch = await bcrypt.compare(
      user_password as string,
      user.user_password
    );
    if (!isMatch) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    // Generating JWT token short lived due to security reasons
    const accessToken = jwt.sign(
      { userId: user.id, isGlobalAdmin: user.isGLOBAL_ADMIN },
      JWT_SECRET,
      { expiresIn: '15m' } //15m life span for access token
    );
    // New refreshToken generation using JWT
    const refreshToken = jwt.sign(
      { userId: user.id, type: 'refresh' }, // Add a type claim to differentiate it
      JWT_SECRET,
      { expiresIn: '7d' } // Valid for 7 days
    );

    // Keep saving it to the DB so you can still securely log users out
    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    //Create in HTTP only
    res.cookie('token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 15 * 60 * 1000,
    });

    // Successfully logged in
    res.status(200).json({
      message: 'Login successful',
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        avatarLink: user.avatarLink,
        isGLOBAL_ADMIN: user.isGLOBAL_ADMIN,
      },
    });
  }
);

// Exchanges a valid refresh token for a new tken acces
export const refresh = async_catcher(
  async (req: Request, res: Response): Promise<void> => {
    const { refreshToken } = req.body;
    //Refresh token if not present ask to mke one
    if (!refreshToken) {
      res.status(401).json({ error: 'Refresh token required' });
      return;
    }

    try {
      //Verify the JWT signature first
      const decoded = jwt.verify(refreshToken as string, JWT_SECRET) as {
        userId: string;
        type: string;
      };

      // Ensure duration
      if (decoded.type !== 'refresh') {
        res.status(401).json({ error: 'Invalid token type' });
        return;
      }

      // Keep the DB check to ensure the token hasn't been revoked via Logout!
      const dbToken = await prisma.refreshToken.findFirst({
        where: {
          token: refreshToken as string,
          expiresAt: { gt: new Date() },
        },
        include: { user: true },
      });

      if (!dbToken) {
        res.status(401).json({ error: 'Refresh token revoked or expired' });
        return;
      }

      // Generate new short-lived token
      const newAccessToken = jwt.sign(
        { userId: dbToken.user.id, isGlobalAdmin: dbToken.user.isGLOBAL_ADMIN },
        JWT_SECRET,
        { expiresIn: '15m' }
      );

      res.cookie('token', newAccessToken, {
        httpOnly: true,
        maxAge: 15 * 60 * 1000,
      });
      res.status(200).json({ message: 'Token refreshed successfully' });
    } catch (err) {
      if (err instanceof error) {
        // If jwt.verify fails
        res.status(401).json({ error: 'Invalid or expired refresh token' });
      }
    }
  }
);

// Logout deletes refresh token from database and invalidats the user session
export const logout = async_catcher(
  async (req: Request, res: Response): Promise<void> => {
    const { refreshToken } = req.body;
    if (refreshToken) {
      await prisma.refreshToken.deleteMany({
        where: { token: refreshToken as string },
      });
    }
    res.clearCookie('token'); // Clearscookie token and deletes refresh token as above
    res.status(200).json({ message: 'Logged out successfully' });
  }
);
