import { useState, useEffect } from 'react';
import styles from './TaskDetailModal.module.css';
import RichText from './RichText';
import { parseRichText } from '../utils/richTextParser';
// Interface for user, comment, auditlog(rewuired for activity timeline)
interface Props {
  taskId: string;
  onClose: () => void;
  onTaskUpdated?: () => void;
}

interface User {
  id: string;
  name: string;
  email: string;
}

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  authorId: string;
  author?: {
    name: string;
  };
}
interface AuditLog {
  id: string;
  action: string;
  oldValue: string | null;
  newValue: string | null;
  timestamp: string;
  user?: {
    name: string;
  };
}
interface TaskDetail {
  id: string;
  title: string;
  description: string | null;
  status: string;
  type: string;
  priority: string;
  createdAt: string;
  dueDate: string | null;
  assigneeId?: string | null;
  assignee: User | null;
  reporter: User | null;
  parent?: {
    title: string;
  } | null;
  comments: Comment[];
  column?: {
    board?: {
      id: string;
      projectId: string;
    };
  };
  auditLogs?: AuditLog[];
}

export const TaskDetailModal = ({ taskId, onClose, onTaskUpdated }: Props) => {
  const [task, setTask] = useState<TaskDetail | null>(null); // Setting tasks
  const [projectUsers, setProjectUsers] = useState<User[]>([]); // For assignee
  const [loading, setLoading] = useState(true); // Intermediate to keep in sync
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null); // Comment editing
  const [activeTab, setActiveTab] = useState<'comments' | 'history'>(
    'comments'
  );
  const [boardColumns, setBoardColumns] = useState<
    // Setting board columns based on the status
    { id: string; name: string; cStatus: string; status: string }[]
  >([]);
  const [availableStories, setAvailableStories] = useState<
    // New added allowing tasks to be added to stories
    { id: string; title: string }[]
  >([]);
  const [currentUser, setCurrentUser] = useState<{
    // For reporteer id
    id: string;
    isGLOBAL_ADMIN: boolean;
  } | null>(null);
  const [projectMembers, setProjectMembers] = useState<
    // FOr mentions
    { userId: string; role: string }[]
  >([]);
  // Fetch Task Details
  useEffect(() => {
    const fetchTaskDetails = async () => {
      try {
        const profileRes = await fetch('/api/users/profile'); // current user set
        if (profileRes.ok) {
          const profileData = await profileRes.json();

          setCurrentUser(profileData);
        }
        const response = await fetch(`/api/tasks/${taskId}`); // setting tasks based on id
        if (response.ok) {
          const data = await response.json();
          setTask(data);

          // Fetch project users for the assignee dropdown
          const projectId = data.column?.board?.projectId;
          const boardId = data.column?.board?.id;
          if (projectId) {
            const userRes = await fetch(`/api/users?projectId=${projectId}`);
            if (userRes.ok) {
              const userData = await userRes.json();
              setProjectUsers(userData);
            } // Sets who are project users as the name suggests
            const membersRes = await fetch(
              `/api/projects/${projectId}/members`
            );
            if (membersRes.ok) {
              const membersData = await membersRes.json();
              setProjectMembers(membersData);
            }
            const storiesRes = await fetch(
              `/api/projects/${projectId}/stories`
            );
            if (storiesRes.ok) {
              const storiesData = await storiesRes.json();
              setAvailableStories(storiesData);
            } // For stories to which task belong to
          }
          if (boardId) {
            const boardRes = await fetch(`/api/boards/${boardId}`);
            if (boardRes.ok) {
              const bData = await boardRes.json();
              setBoardColumns(bData.columns || []); // Save the columns to state
            }
          }
        }
      } catch (err) {
        console.error('Failed to fetch task details', err);
      } finally {
        setLoading(false);
      }
    };
    fetchTaskDetails();
  }, [taskId]);
  const currentMember = projectMembers.find(
    (m) => m.userId === currentUser?.id
  );
  const isProjectAdmin = currentMember?.role === 'PROJECT_ADMIN';
  const isProjectMember = currentMember?.role === 'PROJECT_MEMBER';
  const canManageAssignments = !!(
    currentUser?.isGLOBAL_ADMIN || isProjectAdmin
  );
  const isAssignedToMe =
    task?.assigneeId === currentUser?.id ||
    task?.assignee?.id === currentUser?.id;
  const canEditStatus =
    canManageAssignments ||
    isProjectMember ||
    isAssignedToMe ||
    !task?.assigneeId;
  // Handle Field Updates (Status, Priority, Assignee, Due Date)
  const handleUpdateField = async (field: string, value: string | null) => {
    try {
      const response = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
      // Stringfy makes into JSon input for body
      if (response.ok) {
        if (onTaskUpdated) onTaskUpdated();
        // Optimistically update the UI state
        setTask((prev) => (prev ? { ...prev, [field]: value } : null));
        // If assigning, we should update the assignee object to show the name immediately
        if (field === 'assigneeId') {
          const userObj = projectUsers.find((u) => u.id === value);
          setTask((prev) =>
            prev
              ? { ...prev, assigneeId: value, assignee: userObj || null }
              : null
          );
        }
      } else {
        const err = await response.json();
        alert(err.error || err.message || 'Update failed');
      }
    } catch (err) {
      if (err instanceof Error) alert('Failed to update task');
    }
  };

  const handleAddComment = async (content: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Send the raw markdown text to the database!
        body: JSON.stringify({ content: content }),
      });
      if (res.ok) {
        const newComment = await res.json();
        // Update the local state to show the new comment immediately
        setTask((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            comments: [newComment, ...prev.comments],
          };
        });
      } else {
        const err = await res.json();
        alert(`Error: ${err.error}`);
      }
    } catch (err) {
      console.error('Failed to post comment', err);
      alert('Failed to post comment');
    }
  };
  const handleEditComment = async (commentId: string, content: string) => {
    try {
      const res = await fetch(`/api/comments/${commentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        const updatedComment = await res.json();
        setTask((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            comments: prev.comments.map((c) =>
              c.id === commentId ? updatedComment : c
            ),
          };
        });
        setEditingCommentId(null);
      } else {
        const err = await res.json();
        alert(`Error: ${err.error}`);
      }
    } catch (err) {
      console.error('Failed to edit comment', err);
      alert('Failed to edit comment');
    }
  };
  const handleDeleteComment = async (commentId: string) => {
    if (!window.confirm('Are you sure you want to delete this comment?'))
      return;
    try {
      const res = await fetch(`/api/comments/${commentId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setTask((prev) => {
          if (!prev) return null;
          return {
            ...prev,
            comments: prev.comments.filter((c) => c.id !== commentId),
          };
        });
      } else {
        const err = await res.json();
        alert(`Error: ${err.error}`);
      }
    } catch (err) {
      console.error('Failed to delete comment', err);
      alert('Failed to delete comment');
    }
  };
  if (loading) return <div className={styles.overlay}>Loading details...</div>;
  if (!task) return <div className={styles.overlay}>Task not found.</div>;
  // Helper function to turn raw audit logs into readable sentences for ui
  // Changes userId to name and col id to Names
  const renderAuditMessage = (log: AuditLog) => {
    const userName = log.user?.name || 'Someone';
    const getRealColumnName = (val: string | null) => {
      if (!val) return 'Unknown';
      const matchedCol = boardColumns.find(
        (c) => c.id === val || c.cStatus === val || c.status === val
      );

      if (matchedCol && matchedCol.name) return matchedCol.name;
      return val
        .split('_')
        .map(
          (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        )
        .join(' ');
    }; // Option to pass status in case of some mishap with name of column
    const getRealUserName = (val: string | null) => {
      if (!val || val === 'UNASSIGNED') return 'Unassigned';
      const matchedUser = projectUsers.find((u) => u.id === val);
      if (matchedUser) return matchedUser.name;
      if (task?.assignee?.id === val) return task.assignee.name;
      if (task?.reporter?.id === val) return task.reporter.name;
      return val;
    }; // Gets user name instead of id

    switch (log.action) {
      case 'TASK_CREATED':
        return (
          <span>
            <strong>{userName}</strong> created this item
          </span>
        );

      case 'COLUMN_CHANGE':
      case 'STATUS_CHANGE':
        return (
          <span>
            <strong>{userName}</strong> moved item from{' '}
            <span className={styles.activityBadge}>
              {getRealColumnName(log.oldValue)}
            </span>{' '}
            to{' '}
            <span className={styles.activityBadge}>
              {getRealColumnName(log.newValue)}
            </span>
          </span>
        );

      case 'ASSIGNEE_CHANGE':
        return (
          <span>
            <strong>{userName}</strong> changed assignee from{' '}
            <span className={styles.activityBadge}>
              {getRealUserName(log.oldValue)}
            </span>{' '}
            to{' '}
            <span className={styles.activityBadge}>
              {getRealUserName(log.newValue)}
            </span>
          </span>
        );

      case 'COMMENT_ADDED':
        return (
          <span>
            <strong>{userName}</strong> added a comment
          </span>
        );
      case 'COMMENT_EDITED':
        return (
          <span>
            <strong>{userName}</strong> edited a comment
          </span>
        );
      case 'COMMENT_DELETED':
        return (
          <span>
            <strong>{userName}</strong> deleted a comment
          </span>
        );
      default:
        return (
          <span>
            <strong>{userName}</strong>{' '}
            {log.action.replace(/_/g, ' ').toLowerCase()}
          </span>
        );
    }
  };
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* HEADER */}
        <div className={styles.header}>
          {/* TASK TITLE */}
          <input
            className={styles.taskTitleInput}
            defaultValue={task.title}
            disabled={!canManageAssignments} // Locks it for non-admins
            title={canManageAssignments ? 'Click to edit title' : 'Task Title'}
            onBlur={(e) => {
              const newValue = e.target.value.trim();
              if (newValue && newValue !== task.title) {
                handleUpdateField('title', newValue);
              }
            }}
          />
          <button onClick={onClose} className={styles.closeBtn}>
            ×
          </button>
        </div>

        <p className={styles.subtitle}>
          Type: <strong>{task.type}</strong>
          {task.parent && ` | Parent Story: ${task.parent.title}`}
        </p>

        {/* CONTROLS GRID */}
        <div className={styles.grid}>
          {/* Status */}
          <div className={styles.fieldGroup}>
            <label htmlFor="status-select" className={styles.label}>
              Status
            </label>
            <select
              id="status-select"
              title="Task Status"
              aria-label="Task Status"
              className={styles.select}
              value={task.status}
              disabled={!canEditStatus || task.type === 'STORY'}
              onChange={(e) => handleUpdateField('status', e.target.value)}
            >
              <option value="TO_DO">To Do</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="REVIEW">Review</option>
              <option value="DONE">Done</option>
            </select>
            {task.type === 'STORY' && (
              <small className={styles.helperText}>
                Story status updates automatically.
              </small>
            )}
          </div>
          {/* Priority */}
          <div className={styles.fieldGroup}>
            <label htmlFor="priority-select" className={styles.label}>
              Priority
            </label>
            <select
              id="priority-select"
              title="Task Priority"
              aria-label="Task Priority"
              className={styles.select}
              value={task.priority}
              onChange={(e) => handleUpdateField('priority', e.target.value)}
              disabled={!canManageAssignments}
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>
          {/* Assignee */}
          <div className={styles.fieldGroup}>
            <label htmlFor="assignee-select" className={styles.label}>
              Assignee
            </label>
            <select
              id="assignee-select"
              title="Task Assignee"
              aria-label="Task Assignee"
              className={styles.select}
              value={task.assigneeId || task.assignee?.id || ''}
              onChange={(e) =>
                handleUpdateField('assigneeId', e.target.value || null)
              }
              disabled={!canManageAssignments || projectUsers.length === 0}
            >
              <option value="">Unassigned</option>
              {projectUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </div>

          {/* Due Date */}
          <div className={styles.fieldGroup}>
            <label htmlFor="due-date-input" className={styles.label}>
              Due Date
            </label>
            <input
              id="due-date-input"
              title="Task Due Date"
              aria-label="Task Due Date"
              type="date"
              className={styles.select}
              value={
                task.dueDate
                  ? new Date(task.dueDate).toISOString().split('T')[0]
                  : ''
              }
              onChange={(e) =>
                handleUpdateField(
                  'dueDate',
                  e.target.value ? new Date(e.target.value).toISOString() : null
                )
              }
              disabled={!canManageAssignments}
            />
          </div>

          {/* Reporter (Read Only) */}
          <div className={styles.fieldGroup}>
            <label className={styles.label}>Reporter</label>
            <span className={styles.readOnlyValue}>
              {task.reporter?.name || 'Unknown'}
            </span>
          </div>
          {/* Link to Story (Admins Only) */}
          {task.type !== 'STORY' && (
            <div className={styles.fieldGroup}>
              <label htmlFor="story-select" className={styles.label}>
                Link to Story
              </label>
              <select
                id="story-select"
                title="Select Parent Story"
                aria-label="Select Parent Story"
                className={styles.select}
                value={
                  task.parent
                    ? availableStories.find(
                        (s) => s.title === task.parent?.title
                      )?.id || ''
                    : ''
                }
                onChange={(e) => {
                  const newStoryId = e.target.value;
                  // If they select "Standalone", pass null. Otherwise pass the ID.
                  handleUpdateField('parentId', newStoryId || null);
                  const selectedStory = availableStories.find(
                    (s) => s.id === newStoryId
                  );
                  setTask((prev) =>
                    prev
                      ? {
                          ...prev,
                          parent: selectedStory
                            ? { title: selectedStory.title }
                            : null,
                        }
                      : null
                  );
                }}
                disabled={!isProjectAdmin && !currentUser?.isGLOBAL_ADMIN}
              >
                <option value="">Unlinked (Standalone)</option>
                {availableStories.map((story) => (
                  <option key={story.id} value={story.id}>
                    {story.title}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <hr className={styles.divider} />

        {/* DESCRIPTION */}
        {/* TASK DESCRIPTION */}
        <div className={styles.section}>
          <h4 className={styles.sectionTitle}>Description</h4>
          <textarea
            className={styles.descriptionText}
            defaultValue={task.description || ''}
            disabled={!canManageAssignments} // Locks it for non-admins
            placeholder={
              canManageAssignments
                ? 'Click here to add a detailed description...'
                : 'No description provided.'
            }
            onBlur={(e) => {
              const newValue = e.target.value.trim();
              if (newValue !== task.description) {
                // Calls your existing update function!
                handleUpdateField('description', newValue);
              }
            }}
          />
        </div>

        <hr className={styles.divider} />

        {/* COMMENTS */}
        {/* TABS: COMMENTS & ACTIVITY HISTORY */}
        <div className={styles.section}>
          <div className={styles.tabs}>
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === 'comments' ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveTab('comments')}
            >
              Comments
            </button>
            <button
              type="button"
              className={`${styles.tabBtn} ${activeTab === 'history' ? styles.tabBtnActive : ''}`}
              onClick={() => setActiveTab('history')}
            >
              Activity History
            </button>
          </div>

          {/* TAB CONTENT: COMMENTS */}
          {activeTab === 'comments' && (
            <div>
              <RichText onSubmit={handleAddComment} users={projectUsers} />
              <div className={styles.commentList}>
                {task.comments?.length === 0 ? (
                  <p className={styles.emptyText}>No comments yet.</p>
                ) : (
                  task.comments?.map((comment: Comment) => {
                    const canModify =
                      currentUser?.id === comment.authorId ||
                      isProjectAdmin ||
                      currentUser?.isGLOBAL_ADMIN;

                    return (
                      <div key={comment.id} className={styles.commentItem}>
                        {editingCommentId === comment.id ? (
                          <RichText
                            initialValue={comment.content}
                            onSubmit={(newContent) =>
                              handleEditComment(comment.id, newContent)
                            }
                            onCancel={() => setEditingCommentId(null)}
                            users={projectUsers}
                          />
                        ) : (
                          <>
                            <div className={styles.commentHeader}>
                              <div>
                                <strong className={styles.commentAuthor}>
                                  {comment.author?.name || 'Unknown User'}
                                </strong>
                                <span className={styles.commentDate}>
                                  {new Date(
                                    comment.createdAt
                                  ).toLocaleDateString()}
                                </span>
                              </div>
                              {canModify && (
                                <div className={styles.commentActions}>
                                  <button
                                    onClick={() =>
                                      setEditingCommentId(comment.id)
                                    }
                                    className={`${styles.commentActionBtn}`}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleDeleteComment(comment.id)
                                    }
                                    className={`${styles.commentActionBtn} ${styles.deleteBtn}`}
                                  >
                                    Delete
                                  </button>
                                </div>
                              )}
                            </div>
                            <div
                              className={styles.commentText}
                              dangerouslySetInnerHTML={{
                                __html: parseRichText(comment.content),
                              }}
                            />
                          </>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* TAB CONTENT: ACTIVITY HISTORY */}
          {activeTab === 'history' && (
            <div className={styles.activityList}>
              {(() => {
                const creationLog: AuditLog = {
                  id: 'creation-log',
                  action: 'TASK_CREATED',
                  oldValue: null,
                  newValue: null,
                  timestamp: task.createdAt,
                  user: { name: task.reporter?.name || 'A user' }, // Pull creator from task
                };
                const allLogs = [...(task.auditLogs || []), creationLog].sort(
                  (a, b) =>
                    new Date(b.timestamp).getTime() -
                    new Date(a.timestamp).getTime()
                );
                return allLogs.map((log: AuditLog) => (
                  <div key={log.id} className={styles.activityItem}>
                    <div className={styles.activityTime}>
                      {new Date(log.timestamp).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                    <div className={styles.activityAction}>
                      {renderAuditMessage(log)}
                    </div>
                  </div>
                ));
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
