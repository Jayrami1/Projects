import prisma from '../prisma';

// HELPER FILE TO CHECK WHETHER A USER HAS THE REQUIRED AUTHORITY OVER AN ACTION
export type RequiredLevel =
  | 'PROJECT_ADMIN'
  | 'PROJECT_MEMBER'
  | 'PROJECT_VIEWER';

export async function checkAccess(
  userId: string,
  projectId: string,
  level: RequiredLevel,
  isGlobalAdmin?: boolean,
  isWriteAction: boolean = false
) {
  if (isWriteAction) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { isArchived: true },
    });

    if (project?.isArchived) {
      throw new Error('PROJECT_ARCHIVED');
    }
  }

  if (isGlobalAdmin) return 'GLOBAL_ADMIN'; //global admin check

  if (isGlobalAdmin === undefined) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isGLOBAL_ADMIN: true },
    });
    if (user?.isGLOBAL_ADMIN) return 'GLOBAL_ADMIN';
  }

  // CHECK PROJECT MEMBERSHIP
  const inProject = await prisma.project_Group.findUnique({
    where: {
      userId_projectId: { userId, projectId },
    },
  });

  if (!inProject) throw new Error('NOT_IN_PROJECT');

  // HIERARCHY CHECK
  const hierarchy: Record<string, number> = {
    PROJECT_ADMIN: 3,
    PROJECT_MEMBER: 2,
    PROJECT_VIEWER: 1,
  };

  const currRole = hierarchy[inProject.role];
  const requiredRole = hierarchy[level];

  // Compare current role priority to required priority, if less throw insufficient permissions
  if (currRole < requiredRole) {
    throw new Error('INSUFFICIENT_PERMISSIONS');
  }

  return inProject.role;
}
