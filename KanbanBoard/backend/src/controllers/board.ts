import { Response } from 'express';
import prisma from '../prisma';
import { AuthRequest } from '../middleware/auth';
import { checkAccess } from '../utility/checkAuth';
import { async_catcher } from '../utility/catch';
// Separate export defintion and async function definitions
export const get = async_catcher(gb);
export const deleteB = async_catcher(db);
export const update = async_catcher(ub);
export const create = async_catcher(cb);
//GET
async function gb(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user?.userId;
  if (!userId) {
    //If not logged in or no user then ask for authentication
    res.status(401).json({ error: 'AUTHENTICATION REQUIRED' });
  } else {
    //  Ask the database for the board, including all its nested data
    const board = await prisma.board.findUnique({
      // Stops further execution untill we get param
      where: {
        id: req.params.boardId as string, // get the boardId from the URL parameters
      },
      include: {
        project: true,
        columns: {
          // for each board include its related columns
          orderBy: { order: 'asc' }, // sort cols in ascending order (left to right)
          include: {
            // for each column also include its tasks
            tasks: {
              orderBy: { order: 'asc' }, // Sort tasks top-to-bottom
            },
          },
        },
      },
    });
    // case when board is not found
    if (!board) {
      res.status(404).json({ error: 'BOARD NOT FOUND' });
    } else {
      // If board found then
      await checkAccess(
        userId,
        board.projectId,
        'PROJECT_VIEWER',
        req.user?.isGlobalAdmin //cHECK access vlues of user
      );
      let isCurrentUserAdmin = false;
      if (req.user?.isGlobalAdmin) {
        isCurrentUserAdmin = true;
      } else {
        // If not current user admin then chheck for project member
        const projectMember = await prisma.project_Group.findUnique({
          where: {
            userId_projectId: { userId: userId, projectId: board.projectId },
          },
        });
        if (projectMember?.role === 'PROJECT_ADMIN') {
          isCurrentUserAdmin = true;
        }
      }
      const boardResponse = {
        ...board, // Creates a shallow copy of board with same parameters
        project: {
          ...board.project,
          isCurrentUserAdmin: isCurrentUserAdmin,
        },
      };
      res.status(200).json(boardResponse);
    }
  }
}
// CREATE
async function cb(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ error: 'AUTHENTICATION REQUIRED' });
  } else {
    if (!req.body.name) {
      //NAME IS REQUIRED
      res.status(400).json({ error: 'BOARD NAME REQUIRED' });
    } else {
      const { projectId } = req.params as { projectId: string };
      const proj = await prisma.project.findUnique({
        where: { id: projectId },
      });
      if (!proj) {
        // if the project to which the board is being added doesn't exist, return an error
        res.status(404).json({ error: 'PROJECT NOT FOUND' });
      } else {
        // if the project exists, create the board and return it in the response
        await checkAccess(
          userId,
          projectId,
          'PROJECT_ADMIN',
          req.user?.isGlobalAdmin,
          true
        ); //only project admin and above can create boards
        const newBoard = await prisma.board.create({
          data: {
            name: req.body.name,
            projectId: projectId,
          },
          include: {
            columns: true,
          },
        });
        res.status(201).json(newBoard);
      }
    }
  }
}
//UPDATE
async function ub(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ error: 'AUTHENTICATION REQUIRED' });
  } else {
    if (!req.body.name) {
      res.status(400).json({ error: 'BOARD NAME REQUIRED' });
    } else {
      const curBoard = await prisma.board.findUnique({
        where: { id: req.params.boardId as string },
      });
      if (!curBoard)
        res.status(404).json({ error: 'BOARD NOT FOUND' }); // if the board to update doesn't exist, return an error
      else {
        // if the board exists, update its name and return the updated board in the response
        await checkAccess(
          userId,
          curBoard.projectId,
          'PROJECT_ADMIN',
          req.user?.isGlobalAdmin,
          true
        ); // check if the user has at least PROJECT_ADMIN access to the project before allowing board updates
        const update = await prisma.board.update({
          //ONLY NAME  need be updated
          where: { id: req.params.boardId as string },
          data: { name: req.body.name },
        });
        res.status(200).json(update);
      }
    }
  }
}
// DELETE  (straightforward logic)
async function db(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ error: 'AUTHENTICATION REQUIRED' });
  } else {
    const board = await prisma.board.findUnique({
      where: { id: req.params.boardId as string },
    });
    if (!board) res.status(404).json({ error: 'BOARD NOT FOUND' });
    else {
      await checkAccess(userId, board.projectId, 'PROJECT_ADMIN', true); // check if the user has at least PROJECT_ADMIN access to the project before allowing board deletion
      await prisma.board.delete({
        where: { id: req.params.boardId as string },
      });
      res.status(200).json({ message: 'BOARD DELETED SUCCESSFULLY' });
    }
  }
}
