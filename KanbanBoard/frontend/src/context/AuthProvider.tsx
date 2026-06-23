import { useReducer, useEffect, useState, type ReactNode } from 'react'; // Alternate to useState as can handle complex states with multiple sub-values and can pass dispatch down
import { AuthContext } from './AuthContext';
import { authReducer, initialState } from '../reducers/authReducers'; // Defined reducer and initialState from authReducers

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  //ReactNode type def
  const [state, dispatch] = useReducer(authReducer, initialState); //setup initial state and authreducer
  const [isLoading, setIsLoading] = useState(true); //loading state defaulting to true when the app first opens
  useEffect(() => {
    //useEffect hook for wake up routine to check if user is already logged in when the app loads
    async function fetchCurUser() {
      try {
        const response = await fetch(
          'http://localhost:3000/api/users/profile',
          {
            method: 'GET',
            credentials: 'include',
          }
        );
        if (response.ok) {
          const user = await response.json();
          dispatch({ type: 'LOGIN', payload: user }); // Update state with user data
        } else {
          dispatch({ type: 'LOGOUT' }); // Clear state if not authenticated
        }
      } catch (error) {
        console.error('Error fetching current user:', error);
      } finally {
        setIsLoading(false);
      }
    }
    fetchCurUser();
  }, []); // Empty dependency array to run only on initial mount
  if (isLoading) {
    // Simple loading state while we check if the user is already logged in or not, this prevents the app from flashing the login page before redirecting to projects page if the user is already logged in
    return (
      <div>
        <h2> Loading....</h2>
      </div>
    );
  }

  return (
    //children Allows all pages inside this app to access authPage or login page
    <AuthContext.Provider value={{ state, dispatch }}>
      {children}
    </AuthContext.Provider>
  );
};
