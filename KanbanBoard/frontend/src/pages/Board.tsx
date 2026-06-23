import { useState, useEffect, useCallback, type DragEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styles from './Board.module.css';
import { TaskDetailModal } from '../components/TaskDetailModal';
import { NotificationBell } from '../components/NotificationBell';
import WorkFlow from '../components/WorkFlow';
import ThemeToggle from '../components/ThemeToggle';

interface Task {
  id: string;
  title: string;
  columnId: string;
  type: string;
  priority: string;
}

interface Column {
  id: string;
  name: string;
  wipLimit: number | null;
  tasks: Task[];
  cStatus: 'TO_DO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE';
}

interface BoardData {
  id: string;
  name: string;
  projectId: string;
  columns: Column[];
  project?: {
    id: string;
    workflow?: Record<string, string[]> | null;
    isCurrentUserAdmin?: boolean;
  };
}

interface Story {
  id: string;
  title: string;
}

export const Board = () => {
  const { id: boardId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [viewingTaskId, setViewingTaskId] = useState<string | null>(null); // Setting task
  const [boardData, setBoardData] = useState<BoardData | null>(null); //setting boards
  const [isTaskModal, setIsTaskModal] = useState<{
    // Opening task Modal
    open: boolean;
    colId: string;
  }>({
    open: false,
    colId: '',
  });
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [stories, setStories] = useState<Story[]>([]);
  const [selectedStoryId, setSelectedStoryId] = useState('');
  const [newTaskType, setNewTaskType] = useState('TASK');
  const [newTaskPriority, setNewTaskPriority] = useState('MEDIUM');
  const [isColumnModalOpen, setIsColumnModalOpen] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [newColumnWipLimit, setNewColumnWipLimit] = useState('');
  const [newColumnStatus, setNewColumnStatus] = useState('TO_DO');
  const [isWorkflowModalOpen, setIsWorkflowModalOpen] = useState(false);
  // Fetch Board, Columns, and Tasks

  const fetchBoardData = useCallback(async () => {
    try {
      setLoading(true); // Added this so the UI knows we are fetching
      const response = await fetch(`/api/boards/${boardId}`);
      const data = await response.json();
      if (response.ok) {
        setBoardData(data);
        try {
          const storyRes = await fetch(
            `/api/projects/${data.projectId}/stories` // Try to fetch stories for board
          );
          const storyData = await storyRes.json();
          if (storyRes.ok) {
            setStories(storyData);
          } else {
            console.error('Failed to fetch stories:', storyData.error);
          }
        } catch (serr) {
          console.error('Failed to fetch stories:', serr);
        }
      } else {
        console.error(data.error);
      }
    } catch (err) {
      console.error('Failed to fetch board details', err);
    } finally {
      setLoading(false);
    }
  }, [boardId]);

  useEffect(() => {
    fetchBoardData();
  }, [fetchBoardData]);

  // COLUMN LOGIC
  // NEW COLUMN SUBMIT HANDLER
  const handleAddColumn = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!newColumnName.trim()) return;

    // Parse the WIP limit safely
    const limitVal = parseInt(newColumnWipLimit, 10);
    const finalLimit = isNaN(limitVal) ? null : limitVal;

    try {
      const response = await fetch(`/api/columns/board/${boardId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newColumnName.trim(),
          wipLimit: finalLimit,
          cStatus: newColumnStatus,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setBoardData((prev) =>
          prev
            ? {
                ...prev,
                columns: [...prev.columns, { ...data, tasks: [] }],
              }
            : null
        );

        // Reset and close the modal
        setIsColumnModalOpen(false);
        setNewColumnName('');
        setNewColumnWipLimit('');
        setNewColumnStatus('TO_DO');
      } else {
        alert(data.error);
      }
    } catch (err) {
      if (err instanceof Error) alert('Failed to create column');
    }
  };

  const handleDeleteColumn = async (colId: string) => {
    if (!window.confirm('Delete this column? It must be empty.')) return;

    try {
      const response = await fetch(`/api/columns/${colId}`, {
        method: 'DELETE',
      });
      const data = await response.json();

      if (response.ok) {
        setBoardData((prev) =>
          prev
            ? {
                ...prev,
                columns: prev.columns.filter((c) => c.id !== colId),
              }
            : null
        );
      } else {
        alert(data.error); // Handles "COLUMN NOT EMPTY"
      }
    } catch (err) {
      if (err instanceof Error) alert('Failed to delete column');
    }
  };

  const handleRenameColumn = async (colId: string, cur_name: string) => {
    const newName = prompt('Enter new column name:', cur_name);
    if (!newName || newName.trim() === cur_name) return; // if no change or empty name, do nothing
    try {
      const response = await fetch(`/api/columns/${colId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() }),
      });
      if (response.ok) {
        setBoardData((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            columns: prev.columns.map((col) =>
              col.id === colId ? { ...col, name: newName.trim() } : col
            ),
          };
        });
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to rename column');
      }
    } catch {
      alert('Failed to rename column');
    }
  };

  const handleMoveColumn = async (colIdx: number, dir: 'left' | 'right') => {
    if (!boardData) return;
    const newColumns = [...boardData.columns];
    let newIdx = colIdx;
    if (dir === 'left') newIdx = colIdx - 1;
    else newIdx = colIdx + 1;
    // Prevent moving out of bounds
    if (newIdx < 0 || newIdx >= newColumns.length) return;
    // swap the columns in the UI
    const temp = newColumns[colIdx];
    newColumns[colIdx] = newColumns[newIdx];
    newColumns[newIdx] = temp;
    setBoardData({ ...boardData, columns: newColumns });
    try {
      // Map the new order to send to the backend
      const payload = newColumns.map((col, index) => ({
        id: col.id,
        order: index + 1,
      }));
      const response = await fetch(`/api/columns/reorder`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ columns: payload }),
      });
      if (!response.ok) {
        const errorCause = await response.json();
        const refresh = await fetch(`/api/boards/${boardId}`);
        setBoardData(await refresh.json());
        alert(`Backend Error: ${errorCause.error || 'Unknown Server Error'}`);
      }
    } catch (err) {
      console.error('Failed to reorder columns', err);
    }
  };

  // TASK LOGIC
  const handleTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedType = e.target.value;
    setNewTaskType(selectedType);

    // Automatically escalate priority if it's a BUG and default at medium
    if (selectedType === 'BUG') {
      setNewTaskPriority('HIGH');
    } else {
      setNewTaskPriority('MEDIUM');
    }
  };
  const handleCreateTask = async (e: React.SyntheticEvent) => {
    e.preventDefault(); // task creation function
    if (!newTaskTitle.trim()) return;

    try {
      const response = await fetch(`/api/tasks/column/${isTaskModal.colId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTaskTitle,
          type: newTaskType,
          priority: newTaskPriority,
          parentId: selectedStoryId || null,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        setBoardData((prev) => {
          if (!prev) return null;
          const updatedCols = prev.columns.map((c) =>
            c.id === isTaskModal.colId ? { ...c, tasks: [...c.tasks, data] } : c
          );
          return { ...prev, columns: updatedCols };
        });
        setNewTaskTitle('');
        setSelectedStoryId('');
        setIsTaskModal({ open: false, colId: '' });
        setNewTaskType('TASK');
        setNewTaskPriority('MEDIUM');
      } else {
        alert(data.error); // Handles "WIP LIMIT EXCEEDED"
      }
    } catch (err) {
      if (err instanceof Error) alert('Failed to create task');
    }
  };

  const handleDeleteTask = async (taskId: string, colId: string) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setBoardData((prev) => {
          if (!prev) return null;
          const updatedCols = prev.columns.map((c) =>
            c.id === colId
              ? { ...c, tasks: c.tasks.filter((t) => t.id !== taskId) }
              : c
          );
          return { ...prev, columns: updatedCols };
        });
      }
    } catch (err) {
      console.error('Delete task failed', err);
    }
  };

  // DRAG AND DROP LOGIC
  const onDragStart = (e: DragEvent, taskId: string, sourceColId: string) => {
    e.dataTransfer.setData('taskId', taskId);
    e.dataTransfer.setData('sourceColId', sourceColId);
  };

  const onDrop = async (e: DragEvent, targetColId: string) => {
    const taskId = e.dataTransfer.getData('taskId');

    // Check target column WIP limit client-side before API call
    const targetCol = boardData?.columns.find((c) => c.id === targetColId);
    if (targetCol?.wipLimit && targetCol.tasks.length >= targetCol.wipLimit) {
      alert('CANNOT MOVE: Target column WIP limit reached.');
      return;
    }

    try {
      const response = await fetch(`/api/tasks/reorder`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tasks: [
            {
              id: taskId,
              columnId: targetColId,
              order: targetCol?.tasks.length || 0,
            },
          ],
        }),
      });

      if (response.ok) {
        const refresh = await fetch(`/api/boards/${boardId}`);
        const newData = await refresh.json();
        setBoardData(newData);
      } else {
        const err = await response.json();
        alert(err.error || 'Move rejected by server');
        const refresh = await fetch(`/api/boards/${boardId}`);
        const newData = await refresh.json();
        setBoardData(newData);
      }
    } catch (err) {
      console.error('Move task failed', err);
    }
  };

  if (loading)
    return <div className={styles.boardWrapper}>Loading Board...</div>;

  return (
    <div className={styles.boardWrapper}>
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <button onClick={() => navigate(-1)} className={styles.backBtn}>
            ← Back
          </button>
          <h1>{boardData?.name}</h1>
        </div>
        <div className={styles.headerRight}>
          <ThemeToggle />
          <NotificationBell />
          <button
            className={styles.addBtn}
            onClick={() => setIsColumnModalOpen(true)}
          >
            + Add Column
          </button>
          {boardData?.project?.isCurrentUserAdmin && (
            <button
              onClick={() => setIsWorkflowModalOpen(true)}
              className={styles.workflowButton}
            >
              Customize Workflow
            </button>
          )}
        </div>
      </header>

      <div className={styles.columnContainer}>
        {boardData?.columns.map((col, idx) => (
          <div
            key={col.id}
            className={styles.column}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => onDrop(e, col.id)}
          >
            <div className={styles.columnHeader}>
              <h3
                onClick={() => handleRenameColumn(col.id, col.name)}
                className={styles.columnTitle}
                title="Click to rename"
              >
                {col.name}{' '}
                {col.wipLimit && (
                  <span className={styles.wipBadge}>
                    {col.tasks.length}/{col.wipLimit}
                  </span>
                )}
              </h3>
              <div className={styles.reorderContainer}>
                <button
                  onClick={() => handleMoveColumn(idx, 'left')}
                  disabled={idx === 0}
                  className={styles.reorderBtn}
                >
                  ←
                </button>
                <button
                  onClick={() => handleMoveColumn(idx, 'right')}
                  disabled={idx === boardData.columns.length - 1}
                  className={styles.reorderBtn}
                >
                  →
                </button>
              </div>
              <div className={styles.columnActions}>
                <button
                  onClick={() => handleDeleteColumn(col.id)}
                  className={styles.deleteBtn}
                >
                  Delete
                </button>
                <button
                  className={styles.addBtn}
                  onClick={() => setIsTaskModal({ open: true, colId: col.id })}
                >
                  + Add Task
                </button>
              </div>
            </div>
            {col.tasks.map((task) => (
              <div
                key={task.id}
                className={styles.taskCard}
                draggable
                onDragStart={(e) => onDragStart(e, task.id, col.id)}
              >
                <div className={styles.taskContent}>
                  <span
                    className={styles.taskTitle}
                    onClick={() => setViewingTaskId(task.id)}
                  >
                    {task.title}
                  </span>
                  <button
                    onClick={() => handleDeleteTask(task.id, col.id)}
                    className={styles.taskDeleteBtn}
                    title="Delete Task"
                  >
                    &times;
                  </button>
                </div>
                <div className={styles.taskBadges}>
                  <span
                    className={`${styles.typeBadge} ${task.type === 'BUG' ? styles.typeBug : styles.typeTask}`}
                  >
                    {task.type}
                  </span>
                  <span
                    className={`${styles.priorityBadge} ${styles['priority' + task.priority]}`}
                  >
                    {task.priority}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
      {isColumnModalOpen && (
        <div className={styles.modalOverlay}>
          <form className={styles.modal} onSubmit={handleAddColumn}>
            <h2>Create New Column</h2>

            <div className={styles.inputGroup}>
              <label htmlFor="col-name" className={styles.inputLabel}>
                Column Name *
              </label>
              <input
                id="col-name"
                type="text"
                className={styles.modalInput}
                value={newColumnName}
                onChange={(e) => setNewColumnName(e.target.value)}
                placeholder="Column Name"
                autoFocus
                required
              />
            </div>

            <div className={styles.inputGroup}>
              <label htmlFor="col-wip" className={styles.inputLabel}>
                WIP Limit (Optional)
              </label>
              <input
                id="col-wip"
                type="number"
                min="1"
                className={styles.modalInput}
                value={newColumnWipLimit}
                onChange={(e) => setNewColumnWipLimit(e.target.value)}
                placeholder="Leave empty for no limit"
              />
            </div>

            <div className={styles.inputGroup}>
              <label htmlFor="col-status" className={styles.inputLabel}>
                System Status
              </label>
              <select
                id="col-status"
                className={styles.storySelect}
                value={newColumnStatus}
                onChange={(e) => setNewColumnStatus(e.target.value)}
                title="Map to core status"
              >
                <option value="TO_DO">To Do</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="REVIEW">Review</option>
                <option value="DONE">Done</option>
              </select>
            </div>

            <div className={styles.modalActions}>
              <button
                type="button"
                onClick={() => {
                  setIsColumnModalOpen(false);
                  setNewColumnName('');
                  setNewColumnWipLimit('');
                  setNewColumnStatus('TO_DO');
                }}
              >
                Cancel
              </button>
              <button type="submit" className={styles.addBtn}>
                Create Column
              </button>
            </div>
          </form>
        </div>
      )}
      {isTaskModal.open && (
        <div className={styles.modalOverlay}>
          <form className={styles.modal} onSubmit={handleCreateTask}>
            <h2>Create New Item</h2>
            <textarea
              className={styles.modalInput}
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="Enter title..."
              autoFocus
              required
            />
            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Type</label>
              <select
                id="task-type"
                className={styles.storySelect}
                value={newTaskType}
                onChange={handleTypeChange}
                title="Select Item Type"
                aria-label="Select Item Type"
              >
                <option value="TASK">Task (Standard work item)</option>
                <option value="BUG">Bug (Issue to be fixed)</option>
              </select>
            </div>
            <div className={styles.inputGroup}>
              <label className={styles.inputLabel}>Priority</label>
              <select
                id="task-priority"
                className={styles.storySelect}
                value={newTaskPriority}
                onChange={(e) => setNewTaskPriority(e.target.value)}
                title="Select Priority"
                aria-label="Select Priority"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>
            {stories.length > 0 && (
              <div className={styles.inputGroup}>
                <label className={styles.inputLabel}>Link to Story</label>
                <select
                  id="story-link"
                  className={styles.storySelect}
                  value={selectedStoryId}
                  onChange={(e) => setSelectedStoryId(e.target.value)}
                  title="Link to a Story"
                  aria-label="Link to a Story"
                >
                  <option value="">-- None (Standalone) --</option>
                  {stories.map((story) => (
                    <option key={story.id} value={story.id}>
                      {story.title}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className={styles.modalActions}>
              <button
                type="button"
                onClick={() => {
                  setIsTaskModal({ open: false, colId: '' });
                  setNewTaskTitle('');
                  setSelectedStoryId('');
                  setNewTaskType('TASK');
                  setNewTaskPriority('MEDIUM');
                }}
              >
                Cancel
              </button>
              <button type="submit" className={styles.addBtn}>
                Create Item
              </button>
            </div>
          </form>
        </div>
      )}
      {viewingTaskId && (
        <TaskDetailModal
          taskId={viewingTaskId}
          onClose={() => setViewingTaskId(null)}
          onTaskUpdated={fetchBoardData}
        />
      )}
      {/* RENDER THE WORKFLOW MODAL */}
      {isWorkflowModalOpen && boardData?.project && (
        <WorkFlow
          projectId={boardData.project.id}
          currentWorkflow={boardData.project.workflow || null}
          columns={boardData.columns}
          onClose={() => {
            setIsWorkflowModalOpen(false);
            fetchBoardData();
          }}
        />
      )}
    </div>
  );
};
