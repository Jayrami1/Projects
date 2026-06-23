import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import {
  getProject,
  getProjects,
  createProject,
  updateProject,
  deleteProject,
  assignUser,
  archiveProject,
  unarchiveProject,
  getProjectMembers,
  updateWorkflow,
} from '../controllers/project'; // Adjust the path if your controller folder is named differently

const router = Router();
//MIDDLEWARE
//  force every route below to require a valid login token.
router.use(authenticate);

//ROUTES
// Create a new project
router.post('/', createProject);

// Get all projects
router.get('/', getProjects);
//get project members
router.get('/:projectId/members', getProjectMembers);

// Get a project and its boards
router.get('/:projectId', getProject);
// Update project name/description
router.patch('/:projectId', updateProject);
// Archive/Delete a project
router.delete('/:projectId', deleteProject);
// Assign a user to a project or change their role
router.post('/:projectId/assign', assignUser);
//Added the archive functionality in project.
router.patch('/:projectId/archive', archiveProject);
//Added the unarchive functionality in project.
router.patch('/:projectId/unarchive', unarchiveProject);
//Update workflow functionality
router.patch('/:projectId/workflow', updateWorkflow);
export default router;
