import { Response } from 'express';
import prisma from '../prisma';
import { AuthRequest } from '../middleware/auth';
import { async_catcher } from '../utility/catch';
import bcrypt from 'bcrypt';
import { checkAccess } from '../utility/checkAuth';
import fs from 'fs';
import path from 'path';
// Fetch the authenticated user's profile
export const getProfile = async_catcher(
  async (req: AuthRequest, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'AUTHENTICATION REQUIRED' });
      return;
    }
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        avatarLink: true,
        isGLOBAL_ADMIN: true,
      },
    });
    if (!user) {
      res.status(404).json({ error: 'USER NOT FOUND' });
    } else {
      res.status(200).json(user);
    }
  }
);

// Update name, email, or avatar
export const updateProfile = async_catcher(
  async (req: AuthRequest, res: Response) => {
    const userId = req.user?.userId;
    const { name, email, avatar } = req.body; // Expecting Base64 'avatar' in the JSON body

    if (!userId) {
      res.status(401).json({ error: 'AUTHENTICATION REQUIRED' });
      return;
    }

    let avatarLink = undefined;

    // Native Base64 to File decoding logic
    if (avatar) {
      // Extract the file extension and the raw base64 data
      const matches = avatar.match(/^data:(.*?);base64,(.*)$/);
      if (matches && matches.length === 3) {
        const ext = matches[1].split('/')[1] || 'png';
        const imageBuffer = Buffer.from(matches[2], 'base64');
        const fileName = `avatar-${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext}`;
        // Get the absolute path to your root 'uploads/avatars' directory
        const uploadDir = path.join(process.cwd(), 'uploads/avatars');
        // Check if the directory exists natively, if not, create it
        if (!fs.existsSync(uploadDir)) {
          fs.mkdirSync(uploadDir, { recursive: true });
        }
        // Write the file to the disk natively!
        const filePath = path.join(uploadDir, fileName);
        fs.writeFileSync(filePath, imageBuffer);

        avatarLink = `/uploads/avatars/${fileName}`;
      }
    }
    // Update user based on name email and avatar Link
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        name: name || undefined,
        email: email || undefined,
        avatarLink: avatarLink !== undefined ? avatarLink : undefined,
      },
    });
    res.status(200).json(updatedUser);
  }
);
export const getAllUsers = async_catcher(
  // this function is used to assign roles or tasks
  async (req: AuthRequest, res: Response) => {
    const userId = req.user?.userId;
    const projectId = req.query.projectId as string | undefined;
    const notInProject = req.query.notInProject as string | undefined;
    const checkProjectId = req.query.checkProjectId as string | undefined;

    if (!userId) {
      res.status(401).json({ error: 'AUTHENTICATION REQUIRED' });
      return;
    }
    if (projectId) {
      // for given projectId we need all those with roles higher than or equal viewer
      await checkAccess(
        userId,
        projectId,
        'PROJECT_VIEWER',
        req.user?.isGlobalAdmin
      );
      const members = await prisma.project_Group.findMany({
        where: {
          projectId,
          role: { in: ['PROJECT_MEMBER', 'PROJECT_ADMIN', 'PROJECT_VIEWER'] },
        },
        include: {
          user: {
            select: { id: true, name: true, email: true, avatarLink: true },
          },
        },
      });
      return res
        .status(200)
        .json(
          members
            .map((m) => m.user)
            .sort((a, b) => a.name.localeCompare(b.name))
        );
    }

    if (notInProject) {
      await checkAccess(
        userId,
        notInProject,
        'PROJECT_ADMIN',
        req.user?.isGlobalAdmin
      );
      const existing = await prisma.project_Group.findMany({
        where: { projectId: notInProject },
        select: { userId: true },
      });
      const users = await prisma.user.findMany({
        where: { id: { notIn: existing.map((m) => m.userId) } },
        select: { id: true, name: true, email: true },
        orderBy: { name: 'asc' },
      });
      return res.status(200).json(users);
    }

    // full list for project admin dashboard
    if (checkProjectId) {
      // If this passes, they are authorized to see the full list to manage their project
      await checkAccess(
        userId,
        checkProjectId,
        'PROJECT_ADMIN',
        req.user?.isGlobalAdmin
      );

      const allUsers = await prisma.user.findMany({
        select: { id: true, name: true, email: true, avatarLink: true },
        orderBy: { name: 'asc' },
      });
      return res.status(200).json(allUsers);
    }
    // full list of users for global admin dashboard
    if (req.user?.isGlobalAdmin) {
      const allUsers = await prisma.user.findMany({
        select: { id: true, name: true, email: true, avatarLink: true },
        orderBy: { name: 'asc' },
      });
      return res.status(200).json(allUsers);
    }

    // If none of the above conditions are met
    res.status(403).json({
      error: 'ONLY GLOBAL ADMINS OR PROJECT ADMINS CAN VIEW ALL SYSTEM USERS',
    });
  }
);
export const changePassword = async_catcher(
  async (req: AuthRequest, res: Response) => {
    const userId = req.user?.userId;
    const { currentPassword, newPassword } = req.body;

    if (!userId) {
      res.status(401).json({ error: 'AUTHENTICATION REQUIRED' }); // User must be authenticated to change password
    } else {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        res.status(404).json({ error: 'USER NOT FOUND' });
        return;
      } // To change password we need to make sure of current password is correct
      const match = await bcrypt.compare(currentPassword, user.user_password);
      if (!match) {
        res.status(400).json({ error: 'INCORRECT PASSWORD' });
      } else {
        const saltRounds = 10;
        const newHashedPwd = await bcrypt.hash(newPassword, saltRounds); // Deciding new password
        await prisma.user.update({
          where: { id: userId },
          data: { user_password: newHashedPwd },
        });
        res.status(200).json({ message: 'Password Updated Successfully' });
      }
    }
  }
);
