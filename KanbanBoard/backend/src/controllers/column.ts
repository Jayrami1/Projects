import { Response } from 'express';
import prisma from '../prisma';
import { AuthRequest } from '../middleware/auth';
import { checkAccess } from '../utility/checkAuth';
import { async_catcher } from '../utility/catch';

export const createCol = async_catcher(cc);
export const deleteCol = async_catcher(dc);
export const updateCol = async_catcher(uc);
export const reorderCol = async_catcher(rc);
//CREATE A COLUMN WHILE CHECKING ROLE BASED ACCESS CONTROL
async function cc(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ error: 'AUTHENTICATION REQUIRED' });
  } else {
    const board = await prisma.board.findUnique({
      where: { id: req.params.boardId as string },
    });
    if (!board) {
      res.status(404).json({ error: 'BOARD NOT FOUND' });
    } else {
      const projectId = board.projectId;
      await checkAccess(
        userId,
        projectId,
        'PROJECT_ADMIN',
        req.user?.isGlobalAdmin,
        true
      ); // check if the user has at least PROJECT_ADMIN   access to the project before allowing column creation
      const lastCol = await prisma.column.findFirst({
        // finds the latest column in the board to determine the order value for the new column
        where: { boardId: req.params.boardId as string },
        orderBy: { order: 'desc' }, // find the column with the highest order value in the board
      });
      const newIdx: number = lastCol ? lastCol.order + 1 : 1; // if there are no columns, start with order 1, else increment the highest order by 1 for the new column
      const newCol = await prisma.column.create({
        data: {
          // create a new column with the provided name, wipLimit, cStatus, and the calculated order value
          name: req.body.name,
          wipLimit: req.body.wipLimit || null,
          cStatus: req.body.cStatus,
          order: newIdx,
          boardId: req.params.boardId as string,
        },
      });
      res.status(201).json(newCol); // return the newly created column with a 201 Created status code
    }
  }
}
// we cannot delete a column unless it has no tasks, so we first check if the column is empty before deleting it
// _count is used to count the number of tasks in the column without fetching all the task data, improving efficiency
async function dc(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ error: 'AUTHENTICATION REQUIRED' });
    return;
  }
  const curCol = await prisma.column.findUnique({
    where: { id: req.params.colId as string },
    include: {
      board: true, //to find projectId
      _count: { select: { tasks: true } }, // count the number of tasks in the column to determine if it can be deleted
    },
  });
  if (!curCol)
    res.status(404).json({ error: 'COLUMN NOT FOUND' }); // if the column doesn't exist, return a 404 Not Found error
  else if (curCol._count.tasks > 0)
    res.status(400).json({ error: 'COLUMN NOT EMPTY' }); // if the column has tasks, return a 400 Bad Request error indicating that the column cannot be deleted unless the insider tasks are deleted first
  else {
    const projectId = curCol.board.projectId; //RBAC check to ensure that the user has at least PROJECT_ADMIN access to the project before allowing column deletion
    await checkAccess(
      userId,
      projectId,
      'PROJECT_ADMIN',
      req.user?.isGlobalAdmin,
      true
    ); // check if the user has at least PROJECT_ADMIN access to the project before allowing column deletion
    await prisma.column.delete({ where: { id: req.params.colId as string } }); // if the column exists and is empty, delete it from the database
    res.status(200).json({ message: 'COLUMN DELETED SUCCESSFULLY' }); // return a 200 OK status code with a success message
  }
}

async function uc(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ error: 'AUTHENTICATION REQUIRED' });
  } else {
    const curCol = await prisma.column.findUnique({
      where: { id: req.params.colId as string },
      include: {
        board: true, // Necessary to access the projectId
      },
    });
    if (!curCol) {
      res.status(404).json({ error: 'COLUMN NOT FOUND' });
      return;
    }
    const projectId = curCol.board.projectId;
    await checkAccess(
      userId,
      projectId,
      'PROJECT_ADMIN',
      req.user?.isGlobalAdmin,
      true
    ); // check if the user has at least PROJECT_ADMIN access to the project before allowing column updates
    const freshCol = await prisma.column.update({
      //performing the update
      where: { id: req.params.colId as string }, // find the column to update using the colId from the URL parameters
      data: {
        // update the column's name, wipLimit, and cStatus with the new values provided in the request body
        name: req.body.name !== undefined ? req.body.name : undefined, // only update the name if a new name is provided in the request body
        wipLimit:
          req.body.wipLimit !== undefined ? req.body.wipLimit : undefined,
        cStatus: req.body.cStatus !== undefined ? req.body.cStatus : undefined,
      },
    });
    res.status(200).json(freshCol); // return the updated column with a 200 OK status code
  }
}

async function rc(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ error: 'AUTHENTICATION REQUIRED' });
    return;
  }
  const { columns } = req.body; //extract the array of new orders from the frontend
  if (!columns || !Array.isArray(columns) || columns.length === 0) {
    res.status(400).json({ error: 'COLUMNS ARRAY REQUIRED' });
    return;
  }
  const firstCol = await prisma.column.findUnique({
    where: { id: columns[0].id }, // use the first column's id to fetch the board and project information for RBAC checks
    include: {
      board: true, //board contains the projectId
    },
  });
  if (!firstCol) {
    res.status(404).json({ error: 'COLUMN NOT FOUND' });
    return;
  }
  const projectId = firstCol.board.projectId;
  await checkAccess(
    userId,
    projectId,
    'PROJECT_ADMIN',
    req.user?.isGlobalAdmin,
    true
  ); // check if the user has at least PROJECT_ADMIN access to the project before allowing column reordering
  //helper to update 1 column
  function changeOrder(colId: string, newOrder: number) {
    return prisma.column.update({
      where: { id: colId }, // find the column to update using its id
      data: { order: newOrder }, // update the column's order value to the new order provided in the request body
    });
  }
  const update = columns.map((col: { id: string; order: number }) =>
    changeOrder(col.id, col.order)
  ); // create an array of promises to update the order of each column based on the new orders provided
  await prisma.$transaction(update); // execute all the update operations in a single transaction to ensure consistency of the database. Either all columns are reordered or none of them are
  res.status(200).json({ message: 'COLUMNS REORDERED SUCCESSFULLY' }); // return a 200 OK status code with a success message indicating that the columns have been reordered successfully
}
