import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import styles from './Projects.module.css';
import { NotificationBell } from '../components/NotificationBell';
import ThemeToggle from '../components/ThemeToggle';

interface Project {
  id: string;
  name: string;
  description: string;
  isArchived: boolean;
  createdAt: string; // Metadata: Creation timestamp
}

export const Projects = () => {
  const { state, dispatch } = useAuth(); // Access global user state for role checks
  const navigate = useNavigate();
  const user = state.user;
  console.log('REACT THINKS MY USER IS:', user);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [projectDescription, setProjectDescription] = useState(''); // Added description state
  const [projects, setProjects] = useState<Project[]>([]);
  const [showArchived, setShowArchived] = useState(false);

  // Fetch projects from the database on component mount
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const response = await fetch('/api/projects');
        if (response.ok) {
          const data = await response.json();
          setProjects(data);
        }
      } catch (err) {
        console.error('Failed to fetch projects:', err);
      }
    };
    fetchProjects();
  }, []);

  // CREATE: Logic to save new project to the database
  const handleCreateProject = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!projectName.trim()) return;

    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: projectName,
          description: projectDescription,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error);
      }

      const newProject = await response.json();
      setProjects([newProject, ...projects]);
      setProjectName('');
      setProjectDescription('');
      setIsModalOpen(false);
    } catch (err) {
      if (err instanceof Error) alert(err.message); // Will show "ONLY GLOBAL ADMINS CAN CREATE PROJECTS" if applicable
    }
  };

  // Archive functionality button

  const handleArchiveProject = async (
    e: React.MouseEvent,
    projectId: string
  ) => {
    e.stopPropagation(); // Prevent navigating to the board when clicking archive
    if (!window.confirm('Are you sure you want to archive this project?'))
      return;

    try {
      const response = await fetch(`/api/projects/${projectId}/archive`, {
        method: 'PATCH',
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error);
      }
      // update the local state to mark as archived without refetching the entire list
      setProjects(
        projects.map((p) => {
          if (p.id === projectId) return { ...p, isArchived: true };
          else return p;
        })
      );
    } catch (err) {
      if (err instanceof Error) alert(err.message);
    }
  };

  // unarchive project functionality button

  const handleUnarchiveProject = async (
    e: React.MouseEvent,
    projectId: string
  ) => {
    e.stopPropagation(); // Prevent navigating to the board when clicking unarchive
    if (!window.confirm('Are you sure you want to unarchive this project?'))
      return;

    try {
      const response = await fetch(`/api/projects/${projectId}/unarchive`, {
        method: 'PATCH',
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error);
      }
      // update the local state to mark as unarchived without refetching the entire list
      setProjects(
        projects.map((p) => {
          if (p.id === projectId) return { ...p, isArchived: false };
          else return p;
        })
      );
    } catch (err) {
      if (err instanceof Error) alert(err.message);
    }
  };

  // DELETE: Logic to remove project from database
  const handleDeleteProject = async (
    e: React.MouseEvent,
    projectId: string
  ) => {
    e.stopPropagation(); // Prevent navigating to the board when clicking delete
    if (!window.confirm('Are you sure you want to delete this project?'))
      return;

    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error);
      }

      setProjects(projects.filter((p) => p.id !== projectId));
    } catch (err) {
      if (err instanceof Error) alert(err.message); // Will show role-based errors if user isn't an admin
    }
  };

  const handleLogout = async () => {
    try {
      const storedToken = localStorage.getItem('refreshToken');
      await fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: storedToken }),
      });
      localStorage.removeItem('refreshToken');
      dispatch({ type: 'LOGOUT' });
      navigate('/login');
    } catch (err) {
      console.error('Logout failed', err);
    }
  };
  const activeProjects = projects.filter((p) => !p.isArchived);
  const archivedProjects = projects.filter((p) => p.isArchived);
  const displayProjects = showArchived ? archivedProjects : activeProjects;
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>My Projects</h1>
        <div className={styles.buttonGroup}>
          <ThemeToggle />
          <NotificationBell />
          <button
            className={styles.createBtn}
            onClick={() => setIsModalOpen(true)}
          >
            + New Project
          </button>
          <button onClick={handleLogout} className={styles.logoutBtn}>
            Logout
          </button>
          <div
            className={styles.profileAvatarWrapper}
            onClick={() => navigate('/profile')}
            title="Go to My Profile"
          >
            {user?.avatarLink ? (
              <img
                src={`http://localhost:3000${user.avatarLink}`}
                alt="Profile"
                className={styles.headerAvatarImg}
              />
            ) : (
              <div className={styles.headerAvatarPlaceholder}>
                {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </div>
            )}
          </div>
        </div>
      </header>
      {/* only global admin can view the archived toggle buttons */}
      {user?.isGLOBAL_ADMIN ? (
        <div className={styles.archiveToggleContainer}>
          <h2>{showArchived ? 'Archived Projects' : 'Active Projects'}</h2>
          <button
            onClick={() => setShowArchived(!showArchived)}
            className={styles.toggleArchiveBtn}
          >
            {showArchived ? '<- Back to Active' : 'View Archived Projects'}
          </button>
        </div>
      ) : (
        <div className={styles.activeProjectsHeader}>
          <h2>Active Projects</h2>
        </div>
      )}

      {isModalOpen && (
        <div className={styles.modalOverlay}>
          <form className={styles.modal} onSubmit={handleCreateProject}>
            <h2>Create New Project</h2>
            <input
              className={styles.modalInput}
              type="text"
              placeholder="Project Name"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              autoFocus
              required
            />
            {/* Project Metadata: Description Input */}
            <textarea
              className={styles.modalInput}
              placeholder="Project Description"
              value={projectDescription}
              onChange={(e) => setProjectDescription(e.target.value)}
            />
            <div className={styles.modalActions}>
              <button type="button" onClick={() => setIsModalOpen(false)}>
                Cancel
              </button>
              <button type="submit" className={styles.createBtn}>
                Create
              </button>
            </div>
          </form>
        </div>
      )}

      <div className={styles.projectGrid}>
        {displayProjects.map((project) => (
          <div
            key={project.id}
            className={styles.projectCard}
            onClick={() => navigate(`/projects/${project.id}`)}
          >
            <div className={styles.cardLayout}>
              <div className={styles.projectInfo}>
                <h3>
                  {project.name} {project.isArchived ? '(Archived)' : ''}
                </h3>
                <p>{project.description || 'No description provided.'}</p>
                <small className={styles.timestamp}>
                  Created: {new Date(project.createdAt).toLocaleDateString()}
                </small>
              </div>
              <div className={styles.projectActions}>
                <button
                  className={styles.deleteBtn}
                  onClick={(e) => handleDeleteProject(e, project.id)}
                >
                  Delete
                </button>
                {/* DYNAMIC ARCHIVE AND UNARCHIVE BUTTONS */}
                {user?.isGLOBAL_ADMIN && (
                  <>
                    {project.isArchived ? (
                      <button
                        className={styles.unarchiveBtn}
                        onClick={(e) => handleUnarchiveProject(e, project.id)}
                      >
                        Unarchive
                      </button>
                    ) : (
                      <button
                        className={styles.archiveBtn}
                        onClick={(e) => handleArchiveProject(e, project.id)}
                      >
                        Archive
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
