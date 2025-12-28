import AsyncStorage from '@react-native-async-storage/async-storage';
import createContextHook from '@nkzw/create-context-hook';
import { useEffect, useState } from 'react';
import type { User, UserRole } from '@/types';

const AUTH_KEY = '@boxity_auth_token';
const USER_KEY = '@boxity_user';

export const [AuthProvider, useAuth] = createContextHook(() => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAuth();
  }, []);

  const loadAuth = async () => {
    try {
      const [token, userData] = await Promise.all([
        AsyncStorage.getItem(AUTH_KEY),
        AsyncStorage.getItem(USER_KEY),
      ]);

      if (token && userData) {
              const parsedUser = JSON.parse(userData);
              setUser(parsedUser);
              setIsAuthenticated(true);
      }
    } catch (error) {
      console.error('Failed to load auth:', error);
      await clearAuth();
    } finally {
      setIsLoading(false);
    }
  };

  const clearAuth = async () => {
    await Promise.all([
      AsyncStorage.removeItem(AUTH_KEY),
      AsyncStorage.removeItem(USER_KEY),
    ]);
    setUser(null);
    setIsAuthenticated(false);
  };

  const login = async (email: string): Promise<void> => {
    try {
      // Create a simple token
      const token = `demo_token_${Date.now()}_${Math.random().toString(36).substring(7)}`;

      const newUser: User = {
        id: `user_${Date.now()}`,
        email: email.toLowerCase().trim(),
        role: 'WAREHOUSE' as UserRole,
        name: email.split('@')[0],
      };

      // Store tokens and user data
      await Promise.all([
        AsyncStorage.setItem(AUTH_KEY, token),
        AsyncStorage.setItem(USER_KEY, JSON.stringify(newUser)),
      ]);

      setUser(newUser);
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const logout = async () => {
      await clearAuth();
  };

  const getAuthToken = async (): Promise<string | null> => {
        return await AsyncStorage.getItem(AUTH_KEY);
  };

  return {
    isAuthenticated,
    user,
    isLoading,
    login,
    logout,
    getAuthToken,
  };
});
