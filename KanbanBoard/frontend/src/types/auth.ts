export interface User {
  // Individual type defs required since eslint prevents any type
  id: string;
  name: string;
  email: string;
  role: 'GLOBAL_ADMIN' | 'PROJECT_ADMIN' | 'MEMBER' | 'VIEWER';
  avatarLink?: string | null; // Optional field for user avatar URL, can be null if not set
  isGLOBAL_ADMIN?: boolean;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
}

export type AuthAction = { type: 'LOGIN'; payload: User } | { type: 'LOGOUT' };
