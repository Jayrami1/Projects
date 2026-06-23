import { type AuthState, type AuthAction } from '../types/auth';

export const initialState: AuthState = {
  //Initialised state at login
  user: null,
  isAuthenticated: false,
};

export const authReducer = (
  state: AuthState, //Sets up signals for state and action passed to useReducer later
  action: AuthAction
): AuthState => {
  switch (action.type) {
    case 'LOGIN':
      return { user: action.payload, isAuthenticated: true }; //Action types either login or logout
    case 'LOGOUT':
      return { user: null, isAuthenticated: false }; // Sets either correct user and authenticates or null user and retry to get authenticated
    default:
      return state;
  }
};
