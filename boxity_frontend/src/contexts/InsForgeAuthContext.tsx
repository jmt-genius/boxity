import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { insforge, INSFORGE_CONFIG } from '@/lib/insforge';

interface InsForgeUser {
  id: string;
  email: string;
  profile?: {
    name?: string;
    avatar_url?: string;
    [key: string]: any;
  };
}

interface InsForgeAuthContextType {
  user: InsForgeUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, metadata?: any) => Promise<{ error: Error | null }>;
  signInWithOAuth: (provider: 'google' | 'github') => Promise<void>;
  signOut: () => Promise<void>;
  getSession: () => Promise<{ data: any; error: Error | null }>;
  checkSession: () => Promise<void>;
}

const InsForgeAuthContext = createContext<InsForgeAuthContextType | undefined>(undefined);

export const InsForgeAuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<InsForgeUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    try {
      setIsLoading(true);
      
      // Try to get current user (InsForge SDK method)
      // The SDK should automatically handle session from stored tokens
      const { data, error } = await insforge.auth.getCurrentUser();
      
      if (error) {
        console.log('No session found:', error);
        setUser(null);
        setIsLoading(false);
        return;
      }

      if (data?.user) {
        setUser({
          id: data.user.id,
          email: data.user.email || '',
          profile: data.user.profile || data.user.metadata || {},
        });
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error('Error checking session:', error);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await insforge.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { error };
      }

      if (data?.user) {
        setUser({
          id: data.user.id,
          email: data.user.email || '',
          profile: data.user.profile || data.user.metadata || {},
        });
        // Re-check session after sign in
        await checkSession();
      }

      return { error: null };
    } catch (error: any) {
      return { error: error as Error };
    }
  };

  const signUp = async (email: string, password: string, metadata?: any) => {
    try {
      const { data, error } = await insforge.auth.signUp({
        email,
        password,
        ...(metadata && { metadata }),
      });

      if (error) {
        return { error };
      }

      if (data?.user) {
        setUser({
          id: data.user.id,
          email: data.user.email || '',
          profile: data.user.profile || data.user.metadata || {},
        });
        // Re-check session after sign up
        await checkSession();
      }

      return { error: null };
    } catch (error: any) {
      return { error: error as Error };
    }
  };

  const signInWithOAuth = async (provider: 'google' | 'github') => {
    try {
      const redirectUrl = `${window.location.origin}/login2/callback`;
      
      console.log('Initiating OAuth for:', provider);
      console.log('Redirect URL:', redirectUrl);
      
      // Method 1: Call InsForge API directly to get OAuth URL
      // The API returns: {"authUrl": "https://accounts.google.com/..."}
      try {
        const apiUrl = `${INSFORGE_CONFIG.baseUrl}/api/auth/oauth/${provider}?redirect_uri=${encodeURIComponent(redirectUrl)}`;
        console.log('Calling InsForge OAuth API:', apiUrl);
        
        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: {
            'apikey': INSFORGE_CONFIG.anonKey,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const data = await response.json();
          console.log('OAuth API response:', data);
          
          // Extract authUrl from response
          if (data.authUrl) {
            console.log('Found authUrl, redirecting to:', data.authUrl);
            // Immediately redirect to Google OAuth
            window.location.href = data.authUrl;
            return;
          } else {
            console.error('No authUrl in response:', data);
          }
        } else {
          const errorText = await response.text();
          console.error('OAuth API error:', response.status, errorText);
          try {
            const errorData = JSON.parse(errorText);
            console.error('Error data:', errorData);
          } catch (e) {
            // Not JSON, that's okay
          }
        }
      } catch (apiError: any) {
        console.error('API call failed:', apiError);
      }

      // Method 2: Try SDK method
      try {
        const result = await insforge.auth.signInWithOAuth({
          provider,
          redirectTo: redirectUrl,
        });
        
        console.log('SDK result:', result);
        
        if (result?.data?.url) {
          console.log('Redirecting to (SDK url):', result.data.url);
          window.location.href = result.data.url;
          return;
        }
        
        // Check if data is a string URL
        const dataUrl = result?.data as any;
        if (dataUrl && typeof dataUrl === 'string' && dataUrl.startsWith('http')) {
          console.log('Redirecting to (string):', dataUrl);
          window.location.href = dataUrl;
          return;
        }
        
        // Check for authUrl in response (if API returns it)
        if (dataUrl?.authUrl) {
          console.log('Redirecting to (authUrl):', dataUrl.authUrl);
          window.location.href = dataUrl.authUrl;
          return;
        }
      } catch (sdkError: any) {
        console.error('SDK method failed:', sdkError);
      }

      // If all methods fail, throw error
      throw new Error('Failed to get OAuth URL from InsForge');
      
    } catch (error: any) {
      console.error('OAuth sign in failed:', error);
      throw new Error(`Failed to initiate ${provider} login: ${error.message || 'Unknown error'}`);
    }
  };

  const signOut = async () => {
    try {
      await insforge.auth.signOut();
      setUser(null);
    } catch (error) {
      console.error('Sign out failed:', error);
    }
  };

  const getSession = async () => {
    // Get current user which includes session info
    return await insforge.auth.getCurrentUser();
  };

  return (
    <InsForgeAuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        signIn,
        signUp,
        signInWithOAuth,
        signOut,
        getSession,
        checkSession,
      }}
    >
      {children}
    </InsForgeAuthContext.Provider>
  );
};

export const useInsForgeAuth = () => {
  const context = useContext(InsForgeAuthContext);
  if (context === undefined) {
    throw new Error('useInsForgeAuth must be used within InsForgeAuthProvider');
  }
  return context;
};

