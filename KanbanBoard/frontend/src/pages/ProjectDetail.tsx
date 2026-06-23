import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import styles from './ProjectDetail.module.css';
import { NotificationBell } from '../components/NotificationBell';
import ThemeToggle from '../components/ThemeToggle';

interface Board {
  id: string;
  name: string;
}

interface ProjectInfo {
  id: string;
  name: string;
  description?: string;
}
// User defined roles
interface User {
  id: string;
  name: string;
  email: string;
}
interface Subtask {
  id: string;
  title: string;
  type: string;
  status: string;
  column?: {
    name: string;
    board?: { name: string };
  };
}

interface Story {
  id: string;
  title: string;
  description: string | null;
  status: string;
  subtasks: Subtask[];
}
export const ProjectDetail = () => {
  // We get the projectId from the URL parameters using useParams
  const { projectId } = useParams();
  const navigate = useNavigate();
  // board states
  const [boards, setBoards] = useState<Board[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newBoardName, setNewBoardName] = useState('');
  //story states
  const [stories, setStories] = useState<Story[]>([]);
  const [isStoryModalOpen, setIsStoryModalOpen] = useState(false);
  const [newStoryTitle, setNewStoryTitle] = useState('');
  const [newStoryDesc, setNewStoryDesc] = useState('');
  const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null);
  // user states
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState('PROJECT_MEMBER');
  const [isEditProjectModalOpen, setIsEditProjectModalOpen] = useState(false);
  const [editProjectName, setEditProjectName] = useState('');
  const [editProjectDesc, setEditProjectDesc] = useState('');
  const [showDescription, setShowDescription] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [viewingStory, setViewingStory] = useState<Story | null>(null);
  // Helper to get the right CSS color class based on status
  const getStatusColorClass = (status: string) => {
    switch (status) {
      case 'TO_DO':
        return styles.statusToDo;
      case 'IN_PROGRESS':
        return styles.statusInProgress;
      case 'REVIEW':
        return styles.statusReview;
      case 'DONE':
        return styles.statusDone;
      default:
        return styles.statusToDo;
    }
  };

  useEffect(() => {
    //fetch boards
    fetch(`/api/projects/${projectId}`)
      .then((res) => res.json())
      .then((data) => {
        setIsAdmin(data.isCurrentUserAdmin); // Set admin status for conditional rendering
        setBoards(data.boards || []);
        setProjectInfo({
          id: data.id,
          name: data.name,
          description: data.description,
        });
      })
      .catch((err) => console.error('Failed to fetch boards', err));
    // fetch stories
    fetch(`/api/projects/${projectId}/stories`)
      .then((res) => {
        if (!res.ok) throw new Error(`Server returned ${res.status}`);
        return res.json();
      })
      .then((data) => {
        // We check if the data is an array before setting it to avoid runtime errors if the backend returns an error object instead of an array of stories
        if (Array.isArray(data)) {
          // If the response is an array, we assume it's the list of stories and set it to state
          setStories(data); // Set the stories state with the fetched data
        } else {
          setStories([]);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch stories', err);
        setStories([]); // to prevent crashes
      });
  }, [projectId]);

  const handleCreateBoard = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    const res = await fetch(`/api/boards/project/${projectId}`, {
      // post method for New board
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newBoardName }),
    });
    if (res.ok) {
      const newBoard = await res.json();
      const newBoardId = newBoard.id;
      const defaultColumns = [
        // Default columns for the newly create board setup
        { name: 'To Do', status: 'TO_DO' },
        { name: 'In Progress', status: 'IN_PROGRESS' },
        { name: 'Review', status: 'REVIEW' },
        { name: 'Done', status: 'DONE' },
      ];
      for (const col of defaultColumns) {
        await fetch(`/api/columns/board/${newBoardId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: col.name,
            cStatus: col.status, // Enum type of status
          }),
        });
      }
      setBoards([...boards, newBoard]);
      setIsModalOpen(false);
      setNewBoardName('');
    } else {
      const err = await res.json();
      alert(`${err.error}`);
    }
  };

  const handleDeleteBoard = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm('Delete board?')) return; // Option to delete board
    const res = await fetch(`/api/boards/${id}`, { method: 'DELETE' });
    if (res.ok) setBoards(boards.filter((b) => b.id !== id));
    else {
      const err = await res.json();
      alert(`${err.error}`);
    }
  };

  const handleUpdateProject = async (e: React.SyntheticEvent) => {
    e.preventDefault(); // Update project allows to change name and desscription of project
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editProjectName,
          description: editProjectDesc,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        // Update the UI
        setProjectInfo({
          id: projectId!,
          name: editProjectName,
          description: editProjectDesc,
        });
        setIsEditProjectModalOpen(false);
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (err) {
      if (err instanceof Error) alert(`Error: ${err.message}`);
    }
  };

  const handleCreateStory = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    const res = await fetch(`/api/projects/${projectId}/stories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: newStoryTitle,
        description: newStoryDesc,
      }),
    });
    if (res.ok) {
      const newStory = await res.json();
      setStories([newStory, ...stories]); // Add to top of list
      setIsStoryModalOpen(false);
      setNewStoryTitle('');
      setNewStoryDesc('');
    } else {
      const err = await res.json();
      alert(`Error: ${err.error}`);
    }
  };

  const handleDeleteStory = async (storyId: string) => {
    if (
      !window.confirm(
        // Design decision to delete story and leave behind tasks
        'Are you sure you want to delete this Story? \n\nAll associated tasks and bugs will remain on the boards as standalone items.'
      )
    )
      return;
    try {
      const res = await fetch(`/api/projects/${projectId}/stories/${storyId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        // Remove the story from the UI immediately
        setStories((prev) => prev.filter((s) => s.id !== storyId));
        // Close the viewing modal
        setViewingStory(null);
      } else {
        const err = await res.json();
        alert(`Error: ${err.error}`);
      }
    } catch (err) {
      console.error('Failed to delete story', err);
      alert('Network error while deleting story.');
    }
  };
  const handleOpenAssignModal = async () => {
    try {
      // backend requires projectId to verify if the caller is an Admin
      const response = await fetch(`/api/users?checkProjectId=${projectId}`);
      if (!response.ok) {
        const data = await response.json();
        throw new Error(
          data.error || 'Failed to fetch users. You might not be an Admin.'
        );
      }
      const data = await response.json();
      setAllUsers(data);
      setIsAssignModalOpen(true);
    } catch (err) {
      if (err instanceof Error) alert(err.message);
    }
  };
  const handleAssignUser = async (e: React.SyntheticEvent) => {
    // Assign User functionality
    e.preventDefault();
    if (!selectedUserId || !selectedRole) return;

    try {
      const response = await fetch(`/api/projects/${projectId}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId: selectedUserId,
          role: selectedRole,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error);
      }

      alert('User assigned successfully!');
      setIsAssignModalOpen(false);
      setSelectedUserId('');
      setSelectedRole('PROJECT_MEMBER'); // Reset to default
    } catch (err) {
      if (err instanceof Error) alert(err.message);
    }
  };
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerLeftColumn}>
          <button
            onClick={() => navigate('/projects')}
            className={styles.backBtn}
          >
            ← Back
          </button>
        </div>

        <div className={styles.headerCenterColumn}>
          <span className={styles.dashboardLabel}>Project Dashboard</span>

          <div className={styles.titleRow}>
            <h1 className={styles.mainTitle}>{projectInfo?.name}</h1>
            {isAdmin && (
              <button
                onClick={() => {
                  setEditProjectName(projectInfo?.name || '');
                  setEditProjectDesc(projectInfo?.description || '');
                  setIsEditProjectModalOpen(true);
                }}
                className={styles.editProjectBtn}
                title="Edit Project"
              >
                Edit
              </button>
            )}
          </div>
          {projectInfo?.description && (
            <div className={styles.toggleDescContainer}>
              <button
                onClick={() => setShowDescription(!showDescription)}
                className={styles.toggleDescBtn}
              >
                {showDescription ? 'Hide Description ▲' : 'View Description ▼'}
              </button>

              {showDescription && (
                <p className={styles.expandedDesc}>{projectInfo.description}</p>
              )}
            </div>
          )}
        </div>
        <div className={styles.headerRightColumn}>
          <ThemeToggle />
          <NotificationBell />
          <button onClick={handleOpenAssignModal} className={styles.addBtn}>
            Manage Members
          </button>
        </div>
      </header>

      {/* PROJECT STORIES*/}
      <div className={styles.storiesSection}>
        <div className={styles.storiesHeader}>
          <h2>Project Stories (Backlog)</h2>
          <button
            className={styles.addBtn}
            onClick={() => setIsStoryModalOpen(true)}
          >
            + Add Story
          </button>
        </div>

        {stories.length === 0 ? (
          <p className={styles.emptyText}>No stories created yet.</p>
        ) : (
          <div className={styles.storiesContainer}>
            {stories.map((story) => (
              <div
                key={story.id}
                className={styles.storyCard}
                onClick={() => setViewingStory(story)}
              >
                <h3>{story.title}</h3>
                <p className={styles.statusText}>
                  Status: <strong>{story.status}</strong>
                </p>
                <p className={styles.childTasksText}>
                  Child Tasks: {story.subtasks?.length || 0}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
      <hr className={styles.divider} />

      {/* BOARDS */}
      <div className={styles.sectionHeader}>
        <h2>Project Boards</h2>
        <button className={styles.addBtn} onClick={() => setIsModalOpen(true)}>
          + Add Board
        </button>
      </div>

      <div className={styles.boardGrid}>
        {boards.map((board) => (
          <div
            key={board.id}
            className={styles.boardCard}
            onClick={() => navigate(`/board/${board.id}`)}
          >
            <div className={styles.cardContent}>
              <h3>{board.name}</h3>
              <button
                onClick={(e) => handleDeleteBoard(e, board.id)}
                className={styles.deleteBtn}
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {/*modal to CREATE BOARD */}
      {isModalOpen && (
        <div className={styles.modalOverlay}>
          <form className={styles.modal} onSubmit={handleCreateBoard}>
            <h2>Create New Board</h2>
            <input
              className={styles.modalInput}
              value={newBoardName}
              onChange={(e) => setNewBoardName(e.target.value)}
              placeholder="Board Name"
              required
            />
            <div className={styles.modalActions}>
              <button type="button" onClick={() => setIsModalOpen(false)}>
                Cancel
              </button>
              <button type="submit">Create</button>
            </div>
          </form>
        </div>
      )}
      {/*MODAL: CREATE STORY */}
      {isStoryModalOpen && (
        <div className={styles.modalOverlay}>
          <form className={styles.modal} onSubmit={handleCreateStory}>
            <h2>Create New Story</h2>
            <input
              className={styles.modalInput}
              value={newStoryTitle}
              onChange={(e) => setNewStoryTitle(e.target.value)}
              placeholder="Story Title"
              required
            />
            <textarea
              className={`${styles.modalInput} ${styles.textAreaSpacing}`}
              value={newStoryDesc}
              onChange={(e) => setNewStoryDesc(e.target.value)}
              placeholder="Description (Optional)"
            />
            <div className={styles.modalActions}>
              <button type="button" onClick={() => setIsStoryModalOpen(false)}>
                Cancel
              </button>
              <button type="submit">Create</button>
            </div>
          </form>
        </div>
      )}
      {isAssignModalOpen && (
        <div className={styles.modalOverlay}>
          <form className={styles.modal} onSubmit={handleAssignUser}>
            <h2>Assign User to Project</h2>
            <label className={styles.modalLabel}>Select User</label>
            <select
              className={styles.modalInput}
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              title="Select User"
              aria-label="Select User"
              required
            >
              <option value="">-- Choose a User --</option>
              {allUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email})
                </option>
              ))}
            </select>

            <label className={styles.modalLabel}>Select Role</label>
            <select
              className={styles.modalInput}
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              title="Select Role"
              aria-label="Select Role"
              required
            >
              <option value="PROJECT_VIEWER">Viewer (Read-only)</option>
              <option value="PROJECT_MEMBER">Member (Can edit tasks)</option>
              <option value="PROJECT_ADMIN">Admin (Full access)</option>
            </select>

            <div className={styles.modalActions}>
              <button type="button" onClick={() => setIsAssignModalOpen(false)}>
                Cancel
              </button>
              <button type="submit" className={styles.addBtn}>
                Assign Role
              </button>
            </div>
          </form>
        </div>
      )}

      {/*MODAL: EDIT PROJECT*/}
      {isEditProjectModalOpen && (
        <div className={styles.modalOverlay}>
          <form className={styles.modal} onSubmit={handleUpdateProject}>
            <h2>Edit Project Details</h2>
            <label className={styles.modalLabel}>Project Name</label>
            <input
              className={styles.modalInput}
              value={editProjectName}
              onChange={(e) => setEditProjectName(e.target.value)}
              placeholder="Project Name"
              required
            />
            <label className={styles.modalLabel}>Project Description</label>
            <textarea
              className={`${styles.modalInput} ${styles.textAreaSpacing} ${styles.editDescriptionArea}`}
              value={editProjectDesc}
              onChange={(e) => setEditProjectDesc(e.target.value)}
              placeholder="Project Description"
            />
            <div className={styles.modalActions}>
              <button
                type="button"
                onClick={() => setIsEditProjectModalOpen(false)}
              >
                Cancel
              </button>
              <button type="submit" className={styles.addBtn}>
                Save Changes
              </button>
            </div>
          </form>
        </div>
      )}
      {/* MODAL: VIEW STORY DETAILS & TASKS */}
      {viewingStory && (
        <div
          className={styles.modalOverlay}
          onClick={() => setViewingStory(null)}
        >
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            {/*Header Row */}
            <div className={styles.modalHeader}>
              <h1 className={styles.modalTitle}>{viewingStory.title}</h1>
              <div className={styles.headerActions}>
                {isAdmin && (
                  <button
                    onClick={() => handleDeleteStory(viewingStory.id)}
                    className={styles.deleteBtn}
                  >
                    Delete Story
                  </button>
                )}
                <button
                  className={styles.closeBtn}
                  onClick={() => setViewingStory(null)}
                >
                  &times;
                </button>
              </div>
            </div>
            <div className={styles.statusSection}>
              Status:
              <span
                className={`${styles.statusBadge} ${getStatusColorClass(viewingStory.status)}`}
              >
                {viewingStory.status.replace('_', ' ')}
              </span>
            </div>
            {viewingStory.description && (
              <p className={styles.projectDescription}>
                {viewingStory.description}
              </p>
            )}
            <div className={styles.childTasksSection}>
              <h2 className={styles.sectionTitle}>Child Tasks & Bugs</h2>
              <div className={styles.subtaskList}>
                {!viewingStory.subtasks ||
                viewingStory.subtasks.length === 0 ? (
                  <p className={styles.emptyText}>
                    No items are linked to this story yet.
                  </p>
                ) : (
                  viewingStory.subtasks.map((sub) => (
                    <div key={sub.id} className={styles.childTaskCard}>
                      <div className={styles.taskHeaderRow}>
                        <div className={styles.taskTitleWrapper}>
                          <span className={styles.taskTypeBadge}>
                            {sub.type}
                          </span>
                          <span className={styles.taskTitle}>{sub.title}</span>
                        </div>
                        <span
                          className={`${styles.taskStatusBadge} ${getStatusColorClass(sub.status)}`}
                        >
                          {sub.status.replace('_', ' ')}
                        </span>
                      </div>
                      <div className={styles.taskLocation}>
                        {sub.column?.board?.name || 'Unknown Board'} &rarr;{' '}
                        <strong>{sub.column?.name || 'Unknown Column'}</strong>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
