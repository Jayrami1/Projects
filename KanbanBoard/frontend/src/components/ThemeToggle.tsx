import { useEffect, useState } from 'react';
import styles from './ThemeToggle.module.css';
export default function ThemeToggle() {
  // Check local storage or default to dark mode
  const [isDark, setIsDark] = useState(() => {
    const savedTheme = localStorage.getItem('app-theme');
    return savedTheme ? savedTheme === 'dark' : true;
  });

  useEffect(() => {
    // Apply the theme to the document root
    if (isDark) {
      document.documentElement.setAttribute('data-theme', 'dark');
      localStorage.setItem('app-theme', 'dark');
    } else {
      document.documentElement.setAttribute('data-theme', 'light');
      localStorage.setItem('app-theme', 'light');
    }
  }, [isDark]);

  return (
    <button
      onClick={() => setIsDark(!isDark)}
      className={styles.toggleButton}
      title="Toggle Light/Dark Mode"
    >
      {isDark ? '☀️ Light' : '☾ Dark'}
    </button>
  );
}
