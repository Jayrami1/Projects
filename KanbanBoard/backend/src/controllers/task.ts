import { Response } from 'express';
import prisma from '../prisma';
import { checkAccess } from '../utility/checkAuth';
import { AuthRequest } from '../middleware/auth';
import { async_catcher } from '../utility/catch';
import { Prisma } from '@prisma/client';

export const create = async_catcher(ct);
export const deleteT = async_catcher(dt);
export const update = async_catcher(ut);
export const reorder = async_catcher(rt);
export const get = async_catcher(gt);

async function gt(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ error: 'AUTHENTICATION REQUIRED' });
  } else {
    const task = await prisma.task.findUnique({
      where: { id: req.params.taskId as string },
      include: {
        column: {
          include: {
            board: true,
          },
        }, // eventually both assignee and reporter are users
        assignee: {
          select: {
            //fetch all user details except for passwords
            id: true,
            name: true,
            email: true,
            avatarLink: true,
          },
        },
        reporter: {
          //fetch all user details except for passwords
          select: {
            id: true,
            name: true,
            email: true,
            avatarLink: true,
          },
        },
        parent: true, // fetch parent task if this is a bug or task
        subtasks: true, // include subtasks if this is a story
        comments: {
          include: {
            author: {
              // include author details for each comment
              select: {
                id: true,
                name: true,
                email: true,
                avatarLink: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' }, // order comments by creation time, newest first
        },
        auditLogs: {
          include: {
            user: { select: { name: true } },
          },
          orderBy: { timestamp: 'desc' }, // order audit logs by creation time, newest first
        },
      },
    });
    if (!task) {
      res.status(404).json({ error: 'TASK NOT FOUND' });
    } else {
      let projectId: string | undefined = task.column?.board?.projectId; //(Holds for bugs and tasks not stories)
      // If it's a Story without a column, try to find the project via its subtasks
      if (
        !projectId &&
        task.type === 'STORY' &&
        task.subtasks &&
        task.subtasks.length > 0
      ) {
        const subtask1 = await prisma.task.findUnique({
          where: { id: task.subtasks[0].id },
          include: { column: { include: { board: true } } },
        });
        projectId = subtask1?.column?.board?.projectId; // Make projectId be the subtasks id if not present
      }

      if (!projectId) {
        res.status(400).json({ error: 'CANNOT_DETERMINE_PROJECT_FOR_TASK' });
        return;
      } // No projectId means there is no project to put task to
      await checkAccess(
        userId,
        projectId,
        'PROJECT_VIEWER',
        req.user?.isGlobalAdmin
      ); // check if the user has at least PROJECT_MEMBER access to the project before allowing access to the task details
      res.status(200).json(task);
    }
  }
}

// valid state transitions for tasks, used in the update function to validate status changes
const defaultTransitions: Record<string, string[]> = {
  //map of current status to allowed next statuses
  TO_DO: ['IN_PROGRESS'], // tasks can only move to IN_PROGRESS from TO_DO
  IN_PROGRESS: ['TO_DO', 'REVIEW', 'DONE'], // from IN_PROGRESS, tasks can move back to TO_DO, or forward to REVIEW or DONE
  REVIEW: ['IN_PROGRESS', 'DONE'], // from REVIEW, tasks can move back to IN_PROGRESS or forward to DONE
  DONE: ['IN_PROGRESS', 'REVIEW'], // from DONE, tasks can be reopened back to IN_PROGRESS or REVIEW, but not directly to TO_DO
};

async function ct(req: AuthRequest, res: Response): Promise<void> {
  const colId = req.params.colId as string; // take colId from param of task
  const reporterId = req.user?.userId; // Take userId of current user as reporterId since he is making the task.
  if (!req.body.title) {
    //TITLE IS REQUIRED
    res.status(400).json({ error: 'TASK TITLE REQUIRED' });
  } else if (!reporterId) {
    res.status(401).json({ error: 'AUTHENTICATION REQUIRED' });
  } else {
    const lastTask = await prisma.task.findFirst({
      where: { columnId: colId },
      orderBy: { order: 'desc' },
    });
    //parent col fetching
    const parent = await prisma.column.findUnique({
      where: { id: colId },
      include: { board: true, _count: { select: { tasks: true } } },
    });
    if (!parent) {
      res.status(404).json({ error: 'COLUMN NOT FOUND' });
    } else {
      const projectId = parent.board.projectId;
      await checkAccess(
        reporterId,
        projectId,
        'PROJECT_MEMBER',
        req.user?.isGlobalAdmin,
        true
      ); // check if the user has at least PROJECT_MEMBER access to the project before allowing task creation
      if (parent.wipLimit !== null && parent._count.tasks >= parent.wipLimit) {
        res.status(400).json({ error: 'WIP LIMIT EXCEEDED' }); // Logic for WIP limit exceed throws hard error
      } else {
        const columnId = req.params.colId as string; //Doesn't make sense to generate once more but missed at time of writing so defined again
        if (!columnId) {
          res.status(400).json({ error: 'COLUMN ID IS MISSING IN URL' });
          return;
        }
        const column = await prisma.column.findUnique({
          where: { id: columnId },
          include: { board: true }, // Include the board to get the projectId
        });

        if (!column || !column.board) {
          res.status(404).json({ error: 'COLUMN OR BOARD NOT FOUND' });
          return;
        }
        const projectId = column.board.projectId;
        const newIdx: number = lastTask ? lastTask.order + 1 : 1; //Good way to add task last in order
        const newTask = await prisma.$transaction(async (tx) => {
          // Changes databse but in atomic way either is does or not, nothing in between
          const task = await tx.task.create({
            //  Creates task with following parameters
            data: {
              title: req.body.title,
              description: req.body.description || null,
              order: newIdx,
              status: parent.cStatus,
              type: req.body.type || 'TASK', // Default type to task
              parent: req.body.parentId
                ? { connect: { id: req.body.parentId } } // Parent is actual a story
                : undefined,
              reporter: { connect: { id: req.body.reporterId || reporterId } },
              column: { connect: { id: colId } },
              project: { connect: { id: projectId } },
              priority: req.body.priority || 'MEDIUM', // Default priority set to medium
            },
          });
          if (req.body.parentId) {
            await syncStoryStatus(req.body.parentId, tx); // Essential to update story status after each creation
          }
          return task;
        });
        res.status(201).json(newTask);
      }
    }
  }
}
async function dt(req: AuthRequest, res: Response): Promise<void> {
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ error: 'AUTHENTICATION REQUIRED' });
  } else {
    const curTask = await prisma.task.findUnique({
      where: { id: req.params.taskId as string },
      include: {
        column: {
          include: {
            board: true,
          },
        },
        subtasks: true,
      },
    });
    if (!curTask) res.status(404).json({ error: 'TASK NOT FOUND' });
    else {
      let projectId: string | undefined = curTask.column?.board?.projectId;

      // If it's a Story without a column, try to find the project via its subtasks
      if (
        !projectId &&
        curTask.type === 'STORY' &&
        curTask.subtasks &&
        curTask.subtasks.length > 0
      ) {
        const sub_task = await prisma.task.findUnique({
          // get its child tasks
          where: { id: curTask.subtasks[0].id },
          include: { column: { include: { board: true } } },
        });
        projectId = sub_task?.column?.board?.projectId;
      }

      if (!projectId) {
        res.status(400).json({ error: 'CANNOT_DETERMINE_PROJECT_FOR_TASK' });
        return;
      }
      await checkAccess(
        userId,
        projectId,
        'PROJECT_MEMBER',
        req.user?.isGlobalAdmin,
        true
      ); // check if the user has at least PROJECT_MEMBER access to the project before allowing deletion
      const deleteAndSync = async (trans: Prisma.TransactionClient) => {
        // We already fetched curTask above, so we know if it has a parentId
        await trans.task.delete({
          where: { id: req.params.taskId as string },
        });

        // If the deleted task belonged to a Story, update that Story's status
        if (curTask.parentId) {
          await syncStoryStatus(curTask.parentId, trans); // Important to update stories after this
        }
      };
      await prisma.$transaction(deleteAndSync);
      res.status(200).json({ message: 'TASK DELETED SUCCESSFULLY' });
    }
  }
}
async function ut(req: AuthRequest, res: Response): Promise<void> {
  const taskId = req.params.taskId as string;
  const data = req.body;
  const userId = req.user?.userId;
  if (!userId) {
    res.status(401).json({ error: 'AUTHENTICATION REQUIRED' });
  } else {
    // we get the current task to fetch the project id later used for role checking
    const curTask = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        column: {
          include: {
            board: {
              include: { project: true },
            },
          },
        },
        subtasks: true,
      },
    });
    if (!curTask) {
      res.status(404).json({ error: 'TASK NOT FOUND' });
      return;
    }
    let projectId: string | undefined = curTask.column?.board?.projectId;

    if (
      !projectId &&
      curTask.type === 'STORY' &&
      curTask.subtasks &&
      curTask.subtasks.length > 0
    ) {
      const sub_task = await prisma.task.findUnique({
        where: { id: curTask.subtasks[0].id },
        include: { column: { include: { board: true } } },
      });
      projectId = sub_task?.column?.board?.projectId;
    }

    if (!projectId) {
      res.status(400).json({ error: 'CANNOT_DETERMINE_PROJECT_FOR_TASK' });
      return;
    }
    // role checking
    await checkAccess(
      userId,
      projectId,
      'PROJECT_MEMBER',
      req.user?.isGlobalAdmin,
      true
    );

    const projectMember = await prisma.project_Group.findUnique({
      where: { userId_projectId: { userId: userId, projectId: projectId } },
    });
    const isProjectAdmin = projectMember?.role === 'PROJECT_ADMIN';
    const isGlobalAdmin = !!req.user?.isGlobalAdmin;

    const isAdmin = isGlobalAdmin || isProjectAdmin;
    // const canManageAssignments =
    //   isGlobalAdmin || isProjectAdmin || isProjectMember;
    const changingAdminFields =
      data.priority !== undefined ||
      data.dueDate !== undefined ||
      data.assigneeId !== undefined ||
      data.title !== undefined ||
      data.description !== undefined; // Removed data.columnId from here!

    if (changingAdminFields && !isAdmin) {
      res.status(403).json({
        error:
          'ONLY ADMINS CAN CHANGE TITLE, DESCRIPTION, PRIORITY, DUE DATE, OR ASSIGNEE',
      });
      return;
    }
    const changingStatusOrColumn =
      (data.status !== undefined && data.status !== curTask.status) ||
      (data.columnId !== undefined && data.columnId !== curTask.columnId);

    if (changingStatusOrColumn) {
      if (curTask.type === 'STORY') {
        res
          .status(403)
          .json({ error: 'STORY STATUS CANNOT BE CHANGED MANUALLY' });
        return;
      }

      // Admins can do it, the Assignee can do it, and ANY Member can do it IF it's unassigned
      const canEditStatus =
        isAdmin || curTask.assigneeId === userId || !curTask.assigneeId;

      if (!canEditStatus) {
        res.status(403).json({
          error:
            'YOU CAN ONLY CHANGE THE STATUS OF YOUR OWN TASKS OR UNASSIGNED TASKS',
        });
        return;
      }
    }

    //status should be matched and be in sync with the column if the column is being changed
    if (data.columnId !== undefined && data.columnId !== curTask.columnId) {
      const targetColumn = await prisma.column.findUnique({
        where: { id: data.columnId },
      });
      if (!targetColumn) {
        res.status(404).json({ error: 'DESTINATION_COLUMN_NOT_FOUND' });
        return;
      }
      data.status = targetColumn.cStatus;
    }
    //auto update the column if the state was changes via dropdown
    else if (data.status !== undefined && data.status !== curTask.status) {
      const boardId = curTask.column?.boardId;
      if (boardId) {
        //fetch all columns matching the new status on this board, including their current task count
        const candidateColumns = await prisma.column.findMany({
          where: { boardId: boardId, cStatus: data.status },
          include: {
            _count: { select: { tasks: true } },
          },
          orderBy: { order: 'asc' }, // Check from left to right
        });
        if (candidateColumns.length === 0) {
          res.status(400).json({
            error: `NO_COLUMN_FOR_STATUS`,
            message: `No column mapped to ${data.status} exists on this board.`,
          });
          return;
        }
        let targetColumnId = null;
        // Find the first column that has available capacity
        for (const col of candidateColumns) {
          if (col.wipLimit === null || col._count.tasks < col.wipLimit) {
            targetColumnId = col.id;
            break;
          }
        }
        // Reject if all possible columns are full
        if (!targetColumnId) {
          res.status(400).json({
            error: 'WIP_LIMIT_EXCEEDED',
            message: `Cannot transition: All columns mapped to '${data.status}' are at full capacity.`,
          });
          return;
        }
        //  Map the task to the available column
        data.columnId = targetColumnId;
      }
    }

    //WIP limit enforcement
    if (data.columnId && data.columnId !== curTask.columnId) {
      const newColumn = await prisma.column.findUnique({
        where: { id: data.columnId },
        include: {
          _count: { select: { tasks: true } }, // Counts existing tasks
        },
      });
      if (!newColumn) {
        res.status(404).json({ error: 'DESTINATION_COLUMN_NOT_FOUND' });
        return;
      }
      // If the column has a limit, and adding 1 more task exceeds it, block it!
      if (
        newColumn.wipLimit !== null &&
        newColumn._count.tasks + 1 > newColumn.wipLimit
      ) {
        res.status(400).json({
          error: 'WIP_LIMIT_EXCEEDED',
          message: `This column has a strict limit of ${newColumn.wipLimit} tasks.`,
        });
        return;
      }
    }
    // invalidate some transitions (which are not in the FSM we specified at the top of this file)
    const projectWorkflow = curTask.column?.board?.project?.workflow as Record<
      string,
      string[]
    > | null; // REfers to a row of data in database
    if (data.status && data.status !== curTask.status) {
      if (
        projectWorkflow &&
        curTask.columnId &&
        projectWorkflow[curTask.columnId]
      ) {
        const allowedColumns = projectWorkflow[curTask.columnId];
        const targetColId = data.columnId || curTask.columnId;

        if (!allowedColumns.includes(targetColId)) {
          res.status(400).json({ error: 'INVALID_COLUMN_TRANSITION' });
          return;
        }
      } else {
        // default transistions hold allowed transitions
        const allowedNextStatuses = defaultTransitions[curTask.status] || [];
        if (!allowedNextStatuses.includes(data.status)) {
          res.status(400).json({ error: 'INVALID_STATUS_TRANSITION' });
          return;
        }
      }
    }
    //check for hierarchy consistency
    if (
      curTask.type === 'STORY' &&
      data.status &&
      data.status !== curTask.status
    ) {
      // if the task being updated is a STORY and its status is being changed, we need to check the statuses of its subtasks
      const subtasks = curTask.subtasks;
      if (subtasks.length !== 0) {
        if (data.status === 'DONE') {
          // If marking story as done, all subtasks must also  be done
          let allDone = true;
          for (let i = 0; i < subtasks.length; i++) {
            if (subtasks[i].status !== 'DONE') {
              allDone = false;
              break;
            }
          }
          // const allDone = subtasks.every(subtask => subtask.status === 'DONE');
          if (!allDone) {
            res.status(400).json({ error: 'ALL SUBTASKS NOT DONE' });
            return;
          }
        } else if (data.status === 'TO_DO') {
          // If reverting story to TO_DO, all subtasks must be in the TO_DO stage
          let allinTO_DO = true;
          for (let i = 0; i < subtasks.length; i++) {
            if (subtasks[i].status !== 'TO_DO') {
              allinTO_DO = false;
              break;
            }
          }
          if (!allinTO_DO) {
            res.status(400).json({ error: 'SUBTASKS IN PROGRESS' });
            return;
          }
        }
      }
    }
    // handle resolvedAt and closedAt timestamps based on status changes
    let newResolvedAt =
      data.resolvedAt !== undefined
        ? data.resolvedAt
          ? new Date(data.resolvedAt)
          : null
        : curTask.resolvedAt;
    let newClosedAt =
      data.closedAt !== undefined
        ? data.closedAt
          ? new Date(data.closedAt)
          : null
        : curTask.closedAt;
    if (data.status && data.status !== curTask.status) {
      if (data.status === 'REVIEW' && curTask.status !== 'DONE') {
        newResolvedAt = new Date();
      }
      if (data.status === 'DONE') {
        if (!newResolvedAt) newResolvedAt = new Date();
        newClosedAt = new Date();
      }
      if (data.status !== 'DONE' && curTask.status === 'DONE') {
        newClosedAt = null;
      }
      if (data.status === 'IN_PROGRESS' || data.status === 'TO_DO') {
        newResolvedAt = null;
      }
    }
    // we perform the update and the audit log creation in a single transaction to ensure that if the update fails, the audit log won't be created, and if the audit log creation fails, the task update will be rolled back
    const executeUpdateAndAudit = async (trans: Prisma.TransactionClient) => {
      //Perform the task update
      const update = await trans.task.update({
        where: { id: taskId }, // updating task params
        data: {
          title: data.title !== undefined ? data.title : undefined,
          description:
            data.description !== undefined ? data.description : undefined,
          columnId: data.columnId !== undefined ? data.columnId : undefined,
          type: data.type !== undefined ? data.type : undefined,
          priority: data.priority !== undefined ? data.priority : undefined,
          status: data.status !== undefined ? data.status : undefined,
          assigneeId:
            data.assigneeId !== undefined ? data.assigneeId : undefined,
          parentId: data.parentId !== undefined ? data.parentId : undefined,
          dueDate:
            data.dueDate !== undefined ? new Date(data.dueDate) : undefined,
          resolvedAt: newResolvedAt,
          closedAt: newClosedAt,
        },
      });
      // Audit Log for Status Change
      if (data.status && data.status !== curTask.status) {
        await trans.auditLog.create({
          data: {
            action: 'STATUS_CHANGE',
            oldValue: curTask.status,
            newValue: data.status,
            issueId: taskId,
            userId: userId,
          },
        });
        const boardName = curTask.column?.board?.name || 'Unknown Board';
        const projectName =
          curTask.column?.board?.project?.name || 'Unknown Project';
        await trans.notification.create({
          // creates notifs for tasks status change
          data: {
            type: 'STATUS_CHANGED',
            message: `Task "${curTask.title}" status changed to ${data.status} in "${boardName}" (${projectName})`,
            userId: curTask.reporterId,
            issueId: taskId,
          },
        });
      }
      // Audit Log for Assignee Change
      if (
        data.assigneeId !== undefined &&
        data.assigneeId !== curTask.assigneeId
      ) {
        await trans.auditLog.create({
          data: {
            // Added audit log when assignee changes
            action: 'ASSIGNEE_CHANGE',
            oldValue: curTask.assigneeId || 'UNASSIGNED',
            newValue: data.assigneeId || 'UNASSIGNED',
            issueId: taskId,
            userId: userId,
          },
        });
        if (data.assigneeId) {
          // if there is a new assignee, send them a notification about the assignment
          const boardName = curTask.column?.board?.name || 'Unknown Board';
          const projectName =
            curTask.column?.board?.project?.name || 'Unknown Project';
          await trans.notification.create({
            //Notification creation when assignee made
            data: {
              type: 'TASK_ASSIGNED',
              message: `You have been assigned to task: "${curTask.title}" in "${boardName}" (${projectName})`,
              userId: data.assigneeId,
              issueId: taskId,
            },
          });
        }
      }
      // AUTOMATIC STATUS DERIVATION FOR STORIES
      // if the status changed, sync the active parent story
      if (data.status && data.status !== curTask.status) {
        const activeParentId =
          data.parentId !== undefined ? data.parentId : curTask.parentId;
        if (activeParentId) {
          await syncStoryStatus(activeParentId, trans);
        }
      }
      //if the task was just linked to a story, or moved between stories via the modal
      if (data.parentId !== undefined && data.parentId !== curTask.parentId) {
        // Sync the NEW parent story we just added this task to
        if (data.parentId) {
          await syncStoryStatus(data.parentId, trans);
        }
        // Sync the OLD parent story we just removed this task from (if it had one)
        if (curTask.parentId) {
          await syncStoryStatus(curTask.parentId, trans);
        }
      }
      const detailsChanged = // If anything changed
        (data.title !== undefined && data.title !== curTask.title) ||
        (data.description !== undefined &&
          data.description !== curTask.description);

      if (detailsChanged) {
        // Find all Project Admins
        const admins = await trans.project_Group.findMany({
          where: { projectId: projectId, role: 'PROJECT_ADMIN' },
          select: { userId: true },
        });

        // only assignee and the project admins should be notified about task detail changes
        const usersToNotify = new Set(admins.map((a) => a.userId));
        if (curTask.assigneeId) usersToNotify.add(curTask.assigneeId);
        usersToNotify.delete(userId); // Don't notify the person who made the change!
        // Set to make sure only one notification sent to a person and not to oneself
        // Create the notifications in bulk
        const notifications = Array.from(usersToNotify).map((uid) => ({
          type: 'TASK_UPDATED',
          message: `Task details for "${data.title || curTask.title}" were updated by Admin.`,
          userId: uid,
          issueId: taskId,
        }));

        if (notifications.length > 0) {
          await trans.notification.createMany({ data: notifications });
        }
      }
      return update;
    };
    // execute and audit log changes gives update task a completion
    const finalUpdate = await prisma.$transaction(executeUpdateAndAudit);
    res.status(200).json(finalUpdate);
  }
}
async function rt(req: AuthRequest, res: Response): Promise<void> {
  const { tasks } = req.body; // tasks is an array of objects with id, order, and columnId properties
  const userId = req.user?.userId;

  if (!userId) {
    res.status(401).json({ error: 'AUTHENTICATION REQUIRED' });
    return;
  }

  if (!tasks || !Array.isArray(tasks)) {
    // Requires tasks in first place to reorder
    res.status(400).json({ error: 'TASKS ARRAY REQUIRED' });
    return;
  }

  // Fetch the first task to get the project id
  const ftask = await prisma.task.findUnique({
    where: { id: tasks[0].id },
    include: {
      column: {
        include: { board: true },
      },
      subtasks: true,
    },
  });

  if (!ftask) {
    res.status(404).json({ error: 'TASK NOT FOUND' });
    return;
  }

  let projectId: string | undefined = ftask.column?.board?.projectId;

  // If it's a Story without a column, try to find the project via its subtasks
  if (
    !projectId &&
    ftask.type === 'STORY' &&
    ftask.subtasks &&
    ftask.subtasks.length > 0
  ) {
    const sub_task = await prisma.task.findUnique({
      where: { id: ftask.subtasks[0].id },
      include: { column: { include: { board: true } } },
    });
    projectId = sub_task?.column?.board?.projectId;
  }

  if (!projectId) {
    res.status(400).json({ error: 'CANNOT_DETERMINE_PROJECT_FOR_TASK' });
    return;
  }

  // Check access
  await checkAccess(
    userId,
    projectId,
    'PROJECT_MEMBER',
    req.user?.isGlobalAdmin,
    true
  );

  // Fetch all tasks in the batch
  const allTasks = await prisma.task.findMany({
    where: {
      id: { in: tasks.map((t: { id: string }) => t.id) },
    },
    include: {
      column: {
        include: {
          board: { include: { project: true } },
        },
      },
    },
  });

  const projectMember = await prisma.project_Group.findUnique({
    where: { userId_projectId: { userId, projectId } },
  });
  const isProjectAdmin = projectMember?.role === 'PROJECT_ADMIN';
  const isGlobalAdmin = !!req.user?.isGlobalAdmin;
  const canManageAssignments = isGlobalAdmin || isProjectAdmin;

  // Validate permissions for every task
  for (const tsk of allTasks) {
    const isAssignedToMe = tsk.assigneeId === userId; // Yourself assignee
    const isUnassigned = !tsk.assigneeId; // Is this task still unassigned?

    if (!canManageAssignments && !isAssignedToMe && !isUnassigned) {
      res.status(403).json({
        error: 'FORBIDDEN', // task is movable only if it is unassigned or the person it is assigned to
        message: `You cannot move task "${tsk.title}" because it is assigned to someone else.`,
      });
      return;
    }
  }

  // Array to hold all Prisma promises for the transaction
  const transactionQueries: Prisma.PrismaPromise<unknown>[] = [];
  const storiesToSync = new Set<string>();
  // We will fetch all project members once to use for notifications
  const allProjectMembers = await prisma.project_Group.findMany({
    where: { projectId: projectId },
    select: { userId: true },
  });

  for (const tsk of tasks) {
    const origTask = allTasks.find((t) => t.id === tsk.id);

    // If the task moved to a DIFFERENT column
    if (origTask && origTask.columnId !== tsk.columnId) {
      const targetColumn = await prisma.column.findUnique({
        where: { id: tsk.columnId },
      });

      if (targetColumn && origTask.columnId && tsk.columnId) {
        const projectWorkflow = origTask.column?.board?.project
          ?.workflow as Record<string, string[]> | null;

        // WORKFLOW VALIDATION
        if (projectWorkflow && projectWorkflow[origTask.columnId]) {
          // Check custom workflow
          if (!projectWorkflow[origTask.columnId].includes(tsk.columnId)) {
            res.status(400).json({
              error: `Move from current column to ${targetColumn.name} is not permitted by custom workflow.`,
            });
            return;
          }
        } else {
          // Check default transitions
          const allowedNextStatuses = defaultTransitions[origTask.status] || [];
          if (
            origTask.status !== targetColumn.cStatus &&
            !allowedNextStatuses.includes(targetColumn.cStatus)
          ) {
            res.status(400).json({
              error: `INVALID_TRANSITION: Cannot jump directly from ${origTask.status} to ${targetColumn.cStatus}`,
            });
            return;
          }
        }
        //TIMESTAMPS
        let newResolvedAt = origTask.resolvedAt;
        let newClosedAt = origTask.closedAt;

        if (targetColumn.cStatus === 'REVIEW' && origTask.status !== 'DONE') {
          newResolvedAt = new Date();
        }
        if (targetColumn.cStatus === 'DONE') {
          if (!newResolvedAt) newResolvedAt = new Date();
          newClosedAt = new Date();
        }
        if (targetColumn.cStatus !== 'DONE' && origTask.status === 'DONE') {
          newClosedAt = null;
        }
        if (
          targetColumn.cStatus === 'IN_PROGRESS' ||
          targetColumn.cStatus === 'TO_DO'
        ) {
          newResolvedAt = null;
        }

        //  PUSH TASK UPDATE
        transactionQueries.push(
          prisma.task.update({
            where: { id: tsk.id },
            data: {
              order: tsk.order,
              columnId: tsk.columnId,
              status: targetColumn.cStatus,
              resolvedAt: newResolvedAt,
              closedAt: newClosedAt,
            },
          })
        );

        //PUSH AUDIT LOG
        transactionQueries.push(
          prisma.auditLog.create({
            data: {
              action: 'COLUMN_CHANGE',
              oldValue: origTask.columnId,
              newValue: tsk.columnId,
              issueId: origTask.id,
              userId: userId,
            },
          })
        );

        //PUSH NOTIFICATIONS (To all project members, excluding the mover)
        allProjectMembers.forEach((member) => {
          if (String(member.userId) !== String(userId)) {
            transactionQueries.push(
              prisma.notification.create({
                data: {
                  type: 'STATUS_CHANGED',
                  message: `Task "${origTask.title}" was moved to ${targetColumn.name}.`,
                  userId: member.userId,
                  issueId: origTask.id,
                },
              })
            );
          }
        });

        // PARENT STORY STATUS CALCULATION
        if (origTask.parentId && targetColumn.cStatus !== origTask.status) {
          // REMOVE: await syncStoryStatus(origTask.parentId, prisma);
          // ADD: Queue it to be synced later
          storiesToSync.add(origTask.parentId);
        }
      }
    } else {
      // If reordered within the SAME column, just update the order index
      transactionQueries.push(
        prisma.task.update({
          where: { id: tsk.id },
          data: { order: tsk.order },
        })
      );
    }
  }

  // execute everything safely in one transaction
  await prisma.$transaction(transactionQueries);

  // NEW: Sync the stories NOW, because the database has the updated subtask statuses
  for (const storyId of storiesToSync) {
    await syncStoryStatus(storyId, prisma);
  }

  res.status(200).json({ message: 'TASKS REORDERED SUCCESSFULLY' });
}
export async function syncStoryStatus( // Important function to make sure the story stays synced with tasks reodering creation deletion etc
  storyId: string,
  trans: Prisma.TransactionClient
) {
  const story = await trans.task.findUnique({
    where: { id: storyId },
    include: { subtasks: true },
  });

  if (!story || story.type !== 'STORY') return;

  const subtasks = story.subtasks; // Array of subtasks

  //If no subtasks exist, revert to TO_DO
  if (subtasks.length === 0) {
    if (story.status !== 'TO_DO') {
      await trans.task.update({
        where: { id: storyId },
        data: { status: 'TO_DO', resolvedAt: null, closedAt: null },
      });
    } // Making sure empty stories are at TO_DO
    return;
  }
  //Checks all done and to do location of tasks
  const allDone = subtasks.every((s) => s.status === 'DONE');
  const allToDo = subtasks.every((s) => s.status === 'TO_DO');

  let newStatus: 'TO_DO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE' = 'IN_PROGRESS';
  if (allDone) newStatus = 'DONE';
  else if (allToDo) newStatus = 'TO_DO';

  if (newStatus !== story.status) {
    // Update status of story if the currrent doesnt match.
    await trans.task.update({
      where: { id: storyId },
      data: {
        status: newStatus,
        resolvedAt:
          newStatus === 'DONE'
            ? new Date()
            : story.status === 'DONE'
              ? null
              : story.resolvedAt,
        closedAt: newStatus === 'DONE' ? new Date() : null,
      },
    });
  }
}
