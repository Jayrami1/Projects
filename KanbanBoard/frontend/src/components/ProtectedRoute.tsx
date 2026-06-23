import { Navigate, Outlet } from 'react-router-dom'; //  Route maps specific pages to URL
import { useAuth } from '../context/useAuth'; //UseAuth pulls current userState along with isAuthenticated for protected access

export const ProtectedRoute = () => {
  //Think of this as an outer shell that redirects in case of refresh or incorrect
  const { state } = useAuth(); // password to back to login without compromising internal pages

  // If not authenticated, redirect to login
  if (!state.isAuthenticated) {
    //Authentication state
    return <Navigate to="/login" replace />; // In case of failure route back to login
  }
  return <Outlet />;
};
