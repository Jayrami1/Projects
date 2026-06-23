// pages/Profile.tsx
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/useAuth';
import { useState } from 'react';
import styles from './Profile.module.css';

export function Profile() {
  const { state, dispatch } = useAuth();
  const navigate = useNavigate();

  const user = state.user;
  const [editing, isEditing] = useState(false);
  const [newName, setNewName] = useState(user?.name || '');
  const [newAvatar, setNewAvatar] = useState<File | null>(null); // For avatar display logic
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const LOGOUT = () => {
    dispatch({ type: 'LOGOUT' });
    navigate('/login');
  };

  const SAVE = async () => {
    if (!user) return;
    try {
      // Convert the File to a Base64 String using standard FileReader
      let base64Avatar = null;
      if (newAvatar) {
        base64Avatar = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.readAsDataURL(newAvatar);
          reader.onload = () => resolve(reader.result);
          reader.onerror = (error) => reject(error);
        });
      }
      const response = await fetch('http://localhost:3000/api/users/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: newName,
          avatar: base64Avatar, // Sending the base64 string
        }),
      });

      if (response.ok) {
        const updatedUser = await response.json();
        dispatch({
          type: 'LOGIN',
          payload: updatedUser,
        });
        isEditing(false);
        setNewAvatar(null);
      } else {
        alert('Failed to update profile');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      alert('Error updating profile');
    }
  };

  const CHANGE_PASSWORD = async () => {
    if (newPassword !== confirmPassword) {
      alert('New password and confirm password do not match');
      return;
    }
    if (newPassword.length < 4) {
      alert('Password must be atleast 4 characters long.');
      return;
    }
    try {
      const response = await fetch('http://localhost:3000/api/users/password', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await response.json();

      if (response.ok) {
        alert('Password changed successfully!');
        setIsChangingPassword(false);
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        alert(data.error || 'Failed to change password.');
      }
    } catch (error) {
      console.error('Error changing password:', error);
      alert('Error changing password');
    }
  };

  if (!user) {
    return (
      <div className={styles.loadingContainer}>
        <p>Loading user details...</p>
      </div>
    );
  }

  let nameDisplay;
  if (editing) {
    nameDisplay = (
      <div className={styles.editContainer}>
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className={styles.inputField}
          placeholder="Full Name"
          title="Full Name"
          aria-label="Full Name"
        />
        <div className={styles.avatarInputGroup}>
          <label className={styles.avatarLabel}>Avatar</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setNewAvatar(e.target.files?.[0] || null)}
            title="Upload Avatar"
            aria-label="Upload Avatar"
          />
        </div>
        <div className={styles.actionGroup}>
          <button onClick={SAVE} className={styles.primaryBtn}>
            SAVE
          </button>
          <button onClick={() => isEditing(false)} className={styles.cancelBtn}>
            CANCEL
          </button>
        </div>
      </div>
    );
  } else {
    nameDisplay = (
      <div className={styles.profileHeader}>
        <div className={styles.avatarWrapper}>
          {user.avatarLink ? (
            <img
              src={`http://localhost:3000${user.avatarLink}`}
              alt="User Avatar"
              className={styles.avatarImg}
            />
          ) : (
            <div className={styles.avatarPlaceholder}>
              {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
          )}
        </div>

        <div>
          <h2 className={styles.nameText}> {user.name}</h2>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.pageContainer}>
      <div className={styles.contentWrapper}>
        <button
          className={styles.backBtn}
          onClick={() => navigate('/projects')}
        >
          &larr; Back to Projects
        </button>

        <h1>My Profile</h1>

        <div className={styles.profileCard}>
          {nameDisplay}
          <p className={styles.emailText}>email: {user.email}</p>

          <div className={styles.passwordSection}>
            {!isChangingPassword ? (
              <button
                onClick={() => setIsChangingPassword(true)}
                className={styles.outlineBtn}
              >
                Change Password
              </button>
            ) : (
              <div className={styles.passwordForm}>
                <h3 className={styles.passwordTitle}>Update Password</h3>
                <input
                  type="password"
                  placeholder="Current Password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className={styles.inputField}
                />
                <input
                  type="password"
                  placeholder="New Password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={styles.inputField}
                />
                <input
                  type="password"
                  placeholder="Confirm New Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={styles.inputField}
                />
                <div className={styles.passwordActions}>
                  <button
                    onClick={CHANGE_PASSWORD}
                    className={styles.primaryBtn}
                  >
                    Update
                  </button>
                  <button
                    onClick={() => {
                      setIsChangingPassword(false);
                      setCurrentPassword('');
                      setNewPassword('');
                      setConfirmPassword('');
                    }}
                    className={styles.cancelBtn}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          <div className={styles.bottomActions}>
            {!editing && (
              <button
                onClick={() => isEditing(true)}
                className={styles.primaryBtn}
              >
                Edit Profile
              </button>
            )}

            <button onClick={LOGOUT} className={styles.logoutBtn}>
              Logout
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
