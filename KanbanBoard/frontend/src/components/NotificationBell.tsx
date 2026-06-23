import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import styles from './NotificationBell.module.css'; // Import the CSS module
// Notification taken from backend interface
interface Notification {
  id: string;
  message: string;
  isRead: boolean;
  issueId: string;
  createdAt: string;
}

export const NotificationBell = () => {
  // contains function to set Notifications, opened notifcaiotn and
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate(); // To navigate across browser pages

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        // backend fetch api called
        const response = await fetch('/api/notifications');
        if (response.ok) {
          const data = await response.json();
          setNotifications(data);
        }
      } catch (err) {
        console.error('Failed to fetch notifications', err);
      }
    };
    fetchNotifications();
    const intervalId = setInterval(fetchNotifications, 10000); // Receive notification which is upadated every 10 secs
    return () => clearInterval(intervalId);
  }, []);

  // Calculate unread count
  const n_unread = notifications.filter((n) => !n.isRead).length;
  // AS name suggests
  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.isRead) {
      // If not read the notification read it and start api fetch for read
      try {
        await fetch(`/api/notifications/${notification.id}/read`, {
          method: 'PATCH',
        });
        setNotifications((prev) =>
          prev.map((n) =>
            n.id === notification.id ? { ...n, isRead: true } : n
          )
        );
      } catch (err) {
        console.error('Failed to update notification', err);
      }
    }
    setIsOpen(false);
    if (notification.issueId) {
      try {
        const response = await fetch(`/api/tasks/${notification.issueId}`);
        if (response.ok) {
          // get the issue id and boradId
          const taskData = await response.json();
          const boardId = taskData.column?.board?.id;

          if (boardId) {
            // If found open the board containing the task etc.
            navigate(`/board/${boardId}`);
          } else {
            alert('Could not locate the board for this task.');
          }
        } else if (response.status === 404) {
          // Not found reponse
          alert('This task has been deleted.');
        }
      } catch (err) {
        console.error('Failed to navigate to notification source', err);
      }
    }
  };

  let unreadBadge = null;
  if (n_unread > 0) {
    unreadBadge = <span className={styles.unreadBadge}>{n_unread}</span>;
  }

  const notificationsList: React.ReactNode[] = [];

  if (notifications.length === 0) {
    notificationsList.push(
      //Empty state in bell icon
      <div key="empty-state" className={styles.emptyState}>
        No notifications yet.
      </div>
    );
  } else {
    notifications.forEach((notif) => {
      // If not empty then set grey or not based on its read or not
      notificationsList.push(
        <div
          key={notif.id}
          onClick={() => handleNotificationClick(notif)}
          className={`${styles.notificationItem} ${
            !notif.isRead ? styles.notificationItemUnread : ''
          }`}
        >
          <p
            className={`${styles.message} ${
              !notif.isRead ? styles.messageUnread : ''
            }`}
          >
            {notif.message}
          </p>
          <span className={styles.timestamp}>
            {new Date(notif.createdAt).toLocaleDateString()}
          </span>
        </div>
      ); // Sets the timestamp for notification
    });
  }

  let dropdownMenu = null; // show when bell pressed
  if (isOpen) {
    dropdownMenu = (
      <div className={styles.dropdownMenu}>
        <h4 className={styles.dropdownHeader}>Notifications</h4>
        {notificationsList}
      </div>
    );
  }

  return (
    <div className={styles.bellContainer}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={styles.bellBtn}
        aria-label="Notifications"
      >
        {' '}
        🔔
        {unreadBadge}
      </button>

      {dropdownMenu}
    </div>
  );
};
