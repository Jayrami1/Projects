import { useContext } from 'react';
import { AuthContext } from './AuthContext';

export const useAuth = () => {
  //Hook that components call to grab data
  const context = useContext(AuthContext); // Gets context in one line
  if (!context) {
    // Instead of failing becuz cant read undefined state it throws error
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
