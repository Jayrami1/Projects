import { Response } from 'express';
import prisma from '../prisma';
import { AuthRequest } from '../middleware/auth';
import { checkAccess } from '../utility/checkAuth';
import { async_catcher } from '../utility/catch';

export const getProject = async_catcher(gp);
export const createProject = async_catcher(cp);
export const updateProject = async_catcher(up);
export const deleteProject = async_catcher(dp);
export const assignUser = async_catcher(au);
export const archiveProject = async_catcher(ap);
export const unarchiveProject = async_catcher(unap);
export const getProjects = async_catcher(gps);
export const getProjectMembers = async_catcher(gpm);

//GET ALL PROJECTS
async function gps(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user?.userId;

  if (!userId) {
    res.status(401).json({ error: 'AUTHENTICATION REQUIRED' });
  } else {
    let projects;
    if (req.user?.isGlobalAdmin) {
      // Global Admins can see all active projects
      projects = await prisma.project.findMany();
    } else {
      // Regular users only see projects where they exist in the project_Group table
      const userAssignments = await prisma.project_Group.findMany({
        where: { userId: userId },
        include: { project: true }, // Tells Prisma to fetch the actual project details too
      });
      // Extract the project objects from the assignment records and filter out archived ones
      projects = userAssignments.map((assignment) => assignment.project);
    }
    res.status(200).json(projects);
  }
}

async function gpm(req: AuthRequest, res: Response): Promise<void> {
  const { projectId } = req.params;
  // Fetch all records from the project_Group table for this project
  const members = await prisma.project_Group.findMany({
    where: { projectId: projectId as string },
    select: {
      userId: true,
      role: true,
    },
  });

  res.status(200).json(members);
}

//GET PROJECT
async function gp(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user?.userId;
  const projectId = req.params.projectId as string;

  if (!userId) {
    res.status(401).json({ error: 'AUTHENTICATION REQUIRED' });
  } else {
    // Viewers and above can read.
    await checkAccess(
      userId,
      projectId,
      'PROJECT_VIEWER',
      req.user?.isGlobalAdmin
    );
    try {
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        include: { boards: true },
      });
      if (!project) {
        res.status(404).json({ error: 'PROJECT NOT FOUND' });
        return;
      }
      let isCurrentUserAdmin = false;

      if (userId) {
        // Check if they are a Global Admin first
        if (req.user?.isGlobalAdmin) {
          isCurrentUserAdmin = true;
        } else {
          // If not global, check if they are a PROJECT_ADMIN for this specific project
          const projectMember = await prisma.project_Group.findUnique({
            where: {
              userId_projectId: { userId: userId, projectId: projectId },
            },
          });
          if (projectMember?.role === 'PROJECT_ADMIN') {
            isCurrentUserAdmin = true;
          }
        }
      }
      res.status(200).json({
        ...project,
        isCurrentUserAdmin: isCurrentUserAdmin,
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error fetching project:', error);
      res.status(500).json({ error: 'FAILED TO FETCH PROJECT' });
    }
  }
}

//CREATE PROJECT (CAN ONLY BE DONE BY GLOBAL ADMIN)
async function cp(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user?.userId;
  const isGlobalAdmin = req.user?.isGlobalAdmin;

  if (!userId) {
    res.status(401).json({ error: 'AUTHENTICATION REQUIRED' });
  } else {
    // ENFORCING GLOBAL ROLE: Only Global Admins can create projects
    if (!isGlobalAdmin) {
      res.status(403).json({ error: 'ONLY GLOBAL ADMINS CAN CREATE PROJECTS' });
      return;
    }
    if (!req.body.name) {
      res.status(400).json({ error: 'PROJECT NAME REQUIRED' });
      return;
    }
    // Transaction ensures the project is created and the creator becomes its Admin
    const newProject = await prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          name: req.body.name,
          description: req.body.description || null,
        },
      });
      // Allow only admin to allow and add users on a project
      await tx.project_Group.create({
        data: {
          userId: userId,
          projectId: project.id,
          role: 'PROJECT_ADMIN',
        },
      });

      return project;
    });

    res.status(201).json(newProject);
  }
}

//UPDATE PROJECT (CAN ONLY BE DONE BY PROJECT ADMIN)
async function up(req: AuthRequest, res: Response): Promise<void> {
  const projectId = req.params.projectId as string;
  const { name, description } = req.body;
  const userId = req.user?.userId;

  if (!userId) {
    res.status(401).json({ error: 'AUTHENTICATION REQUIRED' });
  } else {
    try {
      if (!name && description === undefined) {
        res.status(400).json({ error: 'NO UPDATE DATA PROVIDED' });
        return;
      }
      // Verify caller is a Project Admin or Global Admin
      const projectMember = await prisma.project_Group.findUnique({
        where: { userId_projectId: { userId: userId, projectId: projectId } },
      });

      const isAdmin =
        req.user?.isGlobalAdmin || projectMember?.role === 'PROJECT_ADMIN';
      if (!isAdmin) {
        res.status(403).json({ error: 'ONLY ADMINS CAN EDIT PROJECT DETAILS' });
        return;
      }
      // Strictly hierarchy above or equal to PROJECT_ADMIN may bypass
      await checkAccess(
        userId,
        projectId,
        'PROJECT_ADMIN',
        req.user?.isGlobalAdmin,
        true
      );
      //  Wrapped the update and notifications in a transaction
      const updatedProject = await prisma.$transaction(async (trans) => {
        const project = await trans.project.update({
          where: { id: projectId },
          data: {
            name: name ?? undefined,
            description: description ?? undefined,
          },
        });
        // Fetch all project users to broadcast the change
        const allMembers = await trans.project_Group.findMany({
          where: { projectId: projectId },
          select: { userId: true },
        });
        // Create notifications for everyone except the person who made the change
        const notifications = allMembers
          .filter((m) => m.userId !== userId)
          .map((m) => ({
            type: 'PROJECT_UPDATED',
            message: `Project details for "${project.name}" have been updated by an Admin.`,
            userId: m.userId,
          }));

        if (notifications.length > 0) {
          await trans.notification.createMany({ data: notifications });
        }
        return project;
      });

      res.status(200).json(updatedProject);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Project Update Error:', err);
      res.status(500).json({ error: 'FAILED TO UPDATE PROJECT' });
    }
  }
}

//DELETE PROJECT (Project Admin Only)
async function dp(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user?.userId;
  const projectId = req.params.projectId as string;

  if (!userId) {
    res.status(401).json({ error: 'AUTHENTICATION REQUIRED' });
  } else {
    // Strictly PROJECT_ADMIN
    await checkAccess(
      userId,
      projectId,
      'PROJECT_ADMIN',
      req.user?.isGlobalAdmin
    );
    await prisma.project.delete({
      where: { id: projectId },
    });
    res.status(200).json({ message: 'PROJECT DELETED SUCCESSFULLY' });
  }
}

//ASSIGN USERS (GLOBAL OR PROJECT ADMIN)
//adds new users or changes the roles of existing users
async function au(req: AuthRequest, res: Response): Promise<void> {
  const callerId = req.user?.userId;
  const projectId = req.params.projectId as string;
  const { targetUserId, role } = req.body;

  if (!callerId) {
    res.status(401).json({ error: 'AUTHENTICATION REQUIRED' });
  } else {
    if (!targetUserId || !role) {
      res.status(400).json({ error: 'TARGET USER ID AND ROLE REQUIRED' });
      return;
    }
    if (targetUserId === callerId && !req.user?.isGlobalAdmin) {
      res.status(403).json({ error: 'YOU CANNOT CHANGE YOUR OWN ROLE' });
      return;
    }
    try {
      // access granted if caller is global admin or project admin

      await checkAccess(
        callerId,
        projectId,
        'PROJECT_ADMIN',
        req.user?.isGlobalAdmin,
        true
      );

      // fetch the project name for better notifications
      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { name: true },
      });
      // Waits for completion of writing to DB the project group
      const result = await prisma.$transaction(async (trans) => {
        const assignment = await trans.project_Group.upsert({
          where: {
            userId_projectId: { userId: targetUserId, projectId: projectId },
          },
          update: { role: role },
          create: { userId: targetUserId, projectId: projectId, role: role },
        });
        // Renames PROJECT_VIEWER to PROJECT VIEWER and such for notification
        const formattedRole = role.replace('_', ' ');

        await trans.notification.create({
          data: {
            type: 'ROLE_ASSIGNED',
            message: `You have been assigned the role of ${formattedRole} in project "${project?.name || 'Unknown'}".`,
            userId: targetUserId, // THe one who is assigned the role
          },
        });

        return assignment;
      });
      res.status(200).json({
        message: 'USER ASSIGNED SUCCESSFULLY',
        assignment: result,
      });
    } catch (err) {
      // Error analysis
      const message = err instanceof Error ? err.message : 'UNKNOWN ERROR';
      res.status(403).json({ error: 'AUTHORIZATION FAILED', details: message });
    }
  }
}
async function ap(req: AuthRequest, res: Response): Promise<void> {
  // Archive project functionality
  const userId = req.user?.userId;
  const projectId = req.params.projectId as string;

  if (!userId) {
    res.status(401).json({ error: 'AUTHENTICATION REQUIRED' });
    return;
  }
  //only global admins can archive
  if (!req.user?.isGlobalAdmin) {
    res.status(403).json({ error: 'ONLY GLOBAL ADMINS CAN ARCHIVE PROJECTS' });
    return;
  }
  //  TO update DB to archive the project
  const updatedProject = await prisma.project.update({
    where: { id: projectId },
    data: { isArchived: true }, // Archive from db
  });
  res.status(200).json({
    message: 'PROJECT ARCHIVED SUCCESSFULLY',
    project: updatedProject,
  });
}
// lATER on unarchive functionality added as time left
async function unap(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user?.userId;
  const projectId = req.params.projectId as string;

  if (!userId) {
    res.status(401).json({ error: 'AUTHENTICATION REQUIRED' });
    return;
  }
  //only global admins can unarchive
  if (!req.user?.isGlobalAdmin) {
    res
      .status(403)
      .json({ error: 'ONLY GLOBAL ADMINS CAN UNARCHIVE PROJECTS' });
    return;
  }
  // Update project to unarchive true
  const updatedProject = await prisma.project.update({
    where: { id: projectId },
    data: { isArchived: false }, // Unarchive from db
  });
  res.status(200).json({
    message: 'PROJECT UNARCHIVED SUCCESSFULLY',
    project: updatedProject,
  });
}
//Workflow is generated by giving json input to this
export const updateWorkflow = async_catcher(
  async (req: AuthRequest, res: Response): Promise<void> => {
    const projectId = req.params.projectId as string;
    const { workflow } = req.body; // current workflow passed to project
    const userId = req.user?.userId;

    if (!userId) {
      res.status(401).json({ error: 'AUTHENTICATION REQUIRED' });
      return;
    }
    await checkAccess(
      userId,
      projectId,
      'PROJECT_ADMIN',
      req.user?.isGlobalAdmin,
      true
    );
    const updatedProject = await prisma.project.update({
      where: { id: projectId },
      data: { workflow: workflow },
    });
    res
      .status(200)
      .json({ message: 'WORKFLOW UPDATED', workflow: updatedProject.workflow });
  }
);
