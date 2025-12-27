import { createContext, useContext, ReactNode } from 'react';
import { useAuth0, User as Auth0User } from '@auth0/auth0-react';
import type { UserRole } from '@/types';

const AUTH0_DOMAIN = import.meta.env.VITE_AUTH0_DOMAIN || 'dev-s3i27lzn7dyxx1wn.us.auth0.com';
const AUTH0_CLIENT_ID = import.meta.env.VITE_AUTH0_CLIENT_ID || 'Cj5gX5DefENe5HAea91BmcXzxJvxWHUw';
// Only use audience if it's explicitly set and not empty
const AUTH0_AUDIENCE = import.meta.env.VITE_AUTH0_AUDIENCE && import.meta.env.VITE_AUTH0_AUDIENCE.trim() !== '' 
  ? import.meta.env.VITE_AUTH0_AUDIENCE 
  : undefined;
const AUTH0_NAMESPACE = import.meta.env.VITE_AUTH0_NAMESPACE || 'https://boxity.app';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  name: string;
}

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  loginWithRedirect: (options?: any) => Promise<void>;
  logout: (options?: any) => void;
  getAccessTokenSilently: () => Promise<string>;
  loginWithSocial: (connection: string, isSignup?: boolean) => Promise<void>;
  loginWithPasswordless: (email: string, isSignup?: boolean) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const mapAuth0User = (auth0User: Auth0User | undefined): User | null => {
  if (!auth0User) return null;

  const tokenPayload = auth0User as any;
  // Try to get role from Auth0 token claims (set by Auth0 Action/Rule)
  // Priority: Token claim > localStorage (fallback) > default
  const storedRole = localStorage.getItem("boxity_selected_role");
  const role =
    tokenPayload[`${AUTH0_NAMESPACE}/role`] || // From Auth0 Action (preferred)
    tokenPayload.role || // Alternative claim location
    storedRole || // Fallback to selected role
    'WAREHOUSE'; // Default for passwordless users (logistics/warehouse)

  // Clear stored role after using it (only if not from token)
  if (storedRole && !tokenPayload[`${AUTH0_NAMESPACE}/role`]) {
    localStorage.removeItem("boxity_selected_role");
  }

  return {
    id: auth0User.sub || '',
    email: auth0User.email || '',
    role: role as UserRole,
    name: auth0User.name || auth0User.nickname || '',
  };
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const {
    isAuthenticated,
    isLoading,
    user: auth0User,
    loginWithRedirect,
    logout: auth0Logout,
    getAccessTokenSilently,
  } = useAuth0();

  const user = mapAuth0User(auth0User);

  const loginWithSocial = async (connection: string, isSignup: boolean = false) => {
    await loginWithRedirect({
      authorizationParams: {
        connection,
        ...(AUTH0_AUDIENCE && { audience: AUTH0_AUDIENCE }),
        scope: 'openid profile email offline_access',
        ...(isSignup && { screen_hint: 'signup' }),
      },
      appState: {
        returnTo: window.location.origin,
      },
    });
  };

  const loginWithPasswordless = async (email: string, isSignup: boolean = false) => {
    // Store selected role for passwordless users
    const selectedRole = localStorage.getItem("boxity_selected_role");
    
    await loginWithRedirect({
      authorizationParams: {
        connection: 'email', // Auth0 passwordless email connection
        login_hint: email,
        ...(AUTH0_AUDIENCE && { audience: AUTH0_AUDIENCE }),
        scope: 'openid profile email offline_access',
        ...(isSignup && { screen_hint: 'signup' }),
        // Pass role as a parameter that Auth0 Action can read
        ...(selectedRole && { 
          // Store in appState so Auth0 Action can access it
        }),
      },
      appState: {
        returnTo: window.location.origin,
        selectedRole: selectedRole, // Pass role to Auth0
      },
    });
  };

  const logout = (options?: any) => {
    auth0Logout({
      logoutParams: {
        returnTo: window.location.origin,
      },
      ...options,
    });
  };

  const getAuthToken = async (): Promise<string> => {
    try {
      return await getAccessTokenSilently({
        ...(AUTH0_AUDIENCE && {
          authorizationParams: {
            audience: AUTH0_AUDIENCE,
          },
        }),
      });
    } catch (error) {
      console.error('Failed to get access token:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        user,
        loginWithRedirect,
        logout,
        getAccessTokenSilently: getAuthToken,
        loginWithSocial,
        loginWithPasswordless,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Export Auth0 config constants
export const AUTH0_CONFIG = {
  domain: AUTH0_DOMAIN,
  clientId: AUTH0_CLIENT_ID,
  audience: AUTH0_AUDIENCE,
  namespace: AUTH0_NAMESPACE,
};

