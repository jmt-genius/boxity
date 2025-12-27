import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useEffect, useState } from 'react';
import Auth0, { Credentials } from 'react-native-auth0';
import type { User, UserRole } from '@/types';

const AUTH_KEY = '@boxity_auth_token';
const REFRESH_KEY = '@boxity_refresh_token';
const USER_KEY = '@boxity_user';
const ROLE_KEY = '@boxity_selected_role';

// Use environment variables if available, otherwise fallback to provided values
const AUTH0_DOMAIN = process.env.EXPO_PUBLIC_AUTH0_DOMAIN || 'dev-s3i27lzn7dyxx1wn.us.auth0.com';
const AUTH0_CLIENT_ID = process.env.EXPO_PUBLIC_AUTH0_CLIENT_ID || 'Cj5gX5DefENe5HAea91BmcXzxJvxWHUw';
const AUTH0_AUDIENCE = process.env.EXPO_PUBLIC_AUTH0_AUDIENCE || 'https://api.boxity.app';
const AUTH0_NAMESPACE = process.env.EXPO_PUBLIC_AUTH0_NAMESPACE || 'https://boxity.app';

const auth0 = new Auth0({
  domain: AUTH0_DOMAIN,
  clientId: AUTH0_CLIENT_ID,
});

export const [AuthProvider, useAuth] = createContextHook(() => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    loadAuth();
  }, []);

  const loadAuth = async () => {
    try {
      const [token, refreshToken, userData] = await Promise.all([
        AsyncStorage.getItem(AUTH_KEY),
        AsyncStorage.getItem(REFRESH_KEY),
        AsyncStorage.getItem(USER_KEY),
      ]);

      if (token && userData) {
        // Verify token is still valid and refresh if needed
        const isValid = await verifyToken(token);
        if (isValid) {
          setUser(JSON.parse(userData));
          setAccessToken(token);
          setIsAuthenticated(true);
        } else if (refreshToken) {
          // Try to refresh the token
          try {
            const refreshed = await refreshAccessToken(refreshToken);
            if (refreshed) {
              const parsedUser = JSON.parse(userData);
              setUser(parsedUser);
              setIsAuthenticated(true);
            } else {
              await clearAuth();
            }
          } catch {
            await clearAuth();
          }
        } else {
          await clearAuth();
        }
      }
    } catch (error) {
      console.error('Failed to load auth:', error);
      await clearAuth();
    } finally {
      setIsLoading(false);
    }
  };

  const verifyToken = async (token: string): Promise<boolean> {
    try {
      // Decode JWT to check expiration
      const payload = JSON.parse(atob(token.split('.')[1]));
      const exp = payload.exp * 1000; // Convert to milliseconds
      return Date.now() < exp;
    } catch {
      return false;
    }
  };

  const refreshAccessToken = async (refreshToken: string): Promise<boolean> => {
    try {
      const credentials = await auth0.auth.refreshToken({ refreshToken });
      if (credentials.accessToken) {
        await AsyncStorage.setItem(AUTH_KEY, credentials.accessToken);
        if (credentials.refreshToken) {
          await AsyncStorage.setItem(REFRESH_KEY, credentials.refreshToken);
        }
        setAccessToken(credentials.accessToken);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Token refresh failed:', error);
      return false;
    }
  };

  const clearAuth = async () => {
    await Promise.all([
      AsyncStorage.removeItem(AUTH_KEY),
      AsyncStorage.removeItem(REFRESH_KEY),
      AsyncStorage.removeItem(USER_KEY),
      AsyncStorage.removeItem(ROLE_KEY),
    ]);
    setUser(null);
    setAccessToken(null);
    setIsAuthenticated(false);
  };

  const loginWithSocial = async (
    connection: 'google-oauth2' | 'apple',
    role?: UserRole
  ) => {
    try {
      // Store selected role before auth
      if (role) {
        await AsyncStorage.setItem(ROLE_KEY, role);
      }

      const credentials = await auth0.webAuth.authorize({
        scope: 'openid profile email offline_access',
        audience: AUTH0_AUDIENCE,
        connection,
      });

      if (credentials.accessToken) {
        await handleAuthSuccess(credentials, role);
        return credentials;
      }
      throw new Error('No access token received');
    } catch (error: any) {
      if (error.error !== 'a0.session.user_cancelled') {
        console.error('Social login failed:', error);
        throw error;
      }
      throw error;
    }
  };

  const loginWithPasswordless = async (
    email: string,
    role?: UserRole,
    connection: 'email' = 'email'
  ) => {
    try {
      // Store selected role before auth (will be used by Auth0 Action)
      if (role) {
        await AsyncStorage.setItem(ROLE_KEY, role);
      }

      // Start passwordless flow - send OTP code
      await auth0.auth.passwordlessWithEmail({
        email,
        connection,
        send: 'code', // Send OTP code (6 digits)
      });

      // Return email for code verification step
      return { email, connection };
    } catch (error) {
      console.error('Passwordless login failed:', error);
      throw error;
    }
  };

  const verifyPasswordlessCode = async (
    email: string,
    code: string,
    role?: UserRole,
    connection: 'email' = 'email'
  ) => {
    try {
      // Get stored role if not provided
      if (!role) {
        const storedRole = await AsyncStorage.getItem(ROLE_KEY);
        role = (storedRole as UserRole) || undefined;
      }

      // Verify OTP code and get tokens
      const credentials = await auth0.auth.loginWithEmail({
        email,
        code,
        connection,
        audience: AUTH0_AUDIENCE,
        scope: 'openid profile email offline_access',
      });

      if (credentials.accessToken) {
        // Handle successful authentication
        // Role will be read from token claims (set by Auth0 Action)
        await handleAuthSuccess(credentials, role);
        return credentials;
      }
      throw new Error('No access token received');
    } catch (error) {
      console.error('Passwordless verification failed:', error);
      throw error;
    }
  };

  const handleAuthSuccess = async (
    credentials: Credentials,
    selectedRole?: UserRole
  ) => {
    try {
      // Get user info from Auth0
      const userInfo = await auth0.auth.userInfo({
        token: credentials.accessToken!,
      });

      // Extract role from Auth0 metadata, token claims, or selected role
      const tokenPayload = JSON.parse(
        atob(credentials.accessToken!.split('.')[1])
      );
      // Priority: Token claim (from Auth0 Action) > selected role > default
      const role =
        tokenPayload[`${AUTH0_NAMESPACE}/role`] || // From Auth0 Action (preferred)
        tokenPayload.role || // Alternative claim location
        selectedRole || // User-selected role
        (await AsyncStorage.getItem(ROLE_KEY)) || // Stored role
        'WAREHOUSE'; // Default for passwordless users (logistics/warehouse)

      const newUser: User = {
        id: userInfo.sub || userInfo.userId || `user_${Date.now()}`,
        email: userInfo.email || '',
        role: (role as UserRole) || 'MANUFACTURER',
        name: userInfo.name || userInfo.nickname || '',
      };

      // Store tokens and user data
      await Promise.all([
        AsyncStorage.setItem(AUTH_KEY, credentials.accessToken!),
        credentials.refreshToken &&
          AsyncStorage.setItem(REFRESH_KEY, credentials.refreshToken),
        AsyncStorage.setItem(USER_KEY, JSON.stringify(newUser)),
        AsyncStorage.setItem(ROLE_KEY, newUser.role),
      ]);

      setUser(newUser);
      setAccessToken(credentials.accessToken!);
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Failed to handle auth success:', error);
      throw error;
    }
  };

  const logout = async () => {
    try {
      await auth0.webAuth.clearSession();
      await clearAuth();
    } catch (error) {
      console.error('Logout error:', error);
      // Clear local storage even if Auth0 logout fails
      await clearAuth();
    }
  };

  const getAuthToken = async (): Promise<string | null> => {
    if (accessToken) {
      const isValid = await verifyToken(accessToken);
      if (isValid) {
        return accessToken;
      }
    }

    // Try to refresh
    const refreshToken = await AsyncStorage.getItem(REFRESH_KEY);
    if (refreshToken) {
      const refreshed = await refreshAccessToken(refreshToken);
      if (refreshed) {
        return await AsyncStorage.getItem(AUTH_KEY);
      }
    }

    return null;
  };

  return {
    isAuthenticated,
    user,
    isLoading,
    loginWithSocial,
    loginWithPasswordless,
    verifyPasswordlessCode,
    logout,
    getAuthToken,
  };
});
