import { createContext, type Dispatch } from 'react'; //Dispatch holds commands like login/logout
import type { AuthState, AuthAction } from '../types/auth'; // AuthContext holds info about authentication

export const AuthContext = createContext<
  //AuthAction  is basically state of login/logout
  | {
      state: AuthState;
      dispatch: Dispatch<AuthAction>;
    }
  | undefined // Safety measure in case where there is no context (no data when creation) and handles these cases
>(undefined);
