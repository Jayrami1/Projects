import { Routes, Route, Navigate } from 'react-router-dom';
import styles from './App.module.css';
import { Login } from './pages/Login';
import { Projects } from './pages/Projects';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Board } from './pages/Board';
import { Profile } from './pages/Profile';

import { ProjectDetail } from './pages/ProjectDetail';
function App() {
  return (
    <div className={styles.container}>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />

        {/* Protected Routes only accessible if logged in */}
        <Route element={<ProtectedRoute />}>
          <Route path="/projects" element={<Projects />} />
          <Route path="/projects/:projectId" element={<ProjectDetail />} />
          <Route path="/board/:id" element={<Board />} />
          <Route path="/profile" element={<Profile />} />
          {/* Internal redirect if a user hits the base URL while logged in */}
          <Route path="/" element={<Navigate to="/projects" replace />} />
        </Route>

        {/*404 handler*/}
        <Route
          path="*"
          element={
            <div className={styles.card}>
              <h1>404 - Page Not Found</h1>
            </div>
          }
        />
      </Routes>
    </div>
  );
}

export default App;
