import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useInsForgeAuth } from "@/contexts/InsForgeAuthContext";
import { insforge } from "@/lib/insforge";
import { Loader2 } from "lucide-react";

export const InsForgeAuthCallback = () => {
  const { isLoading, isAuthenticated, checkSession } = useInsForgeAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        setIsProcessing(true);
        
        // Check for error in URL
        const error = searchParams.get('error');
        const errorDescription = searchParams.get('error_description');
        
        if (error) {
          console.error('OAuth error:', error, errorDescription);
          navigate("/login2", {
            replace: true,
            state: { 
              error: errorDescription || error || "Authentication failed. Please try again." 
            }
          });
          return;
        }

        // Check for access token or code in URL params and hash
        const accessToken = searchParams.get('access_token');
        const refreshToken = searchParams.get('refresh_token');
        const code = searchParams.get('code');
        
        // Also check hash fragment (OAuth 2.0 often uses hash)
        const hash = window.location.hash.substring(1);
        const hashParams = new URLSearchParams(hash);
        const hashAccessToken = hashParams.get('access_token');
        const hashRefreshToken = hashParams.get('refresh_token');
        const hashCode = hashParams.get('code');
        
        const finalAccessToken = accessToken || hashAccessToken;
        const finalRefreshToken = refreshToken || hashRefreshToken;
        const finalCode = code || hashCode;
        
        console.log('Callback URL:', window.location.href);
        console.log('Callback params:', { 
          accessToken: !!finalAccessToken, 
          refreshToken: !!finalRefreshToken, 
          code: !!finalCode,
          hash: hash.substring(0, 100)
        });

        // If we have tokens, the SDK should automatically process them
        // But we need to wait and check multiple times
        if (finalAccessToken || finalCode) {
          console.log('Tokens found in callback, processing...');
          
          // Wait for SDK to process tokens (InsForge SDK handles this automatically)
          // Check session multiple times with delays
          for (let i = 0; i < 5; i++) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            await checkSession();
            
            // Check if we're authenticated now
            if (isAuthenticated) {
              console.log('Authentication successful!');
              navigate("/", { replace: true });
              return;
            }
          }
        } else {
          // No tokens in URL - check if SDK already processed them
          console.log('No tokens in URL, checking if session exists...');
          await checkSession();
        }

        // Final session check with longer wait
        await new Promise(resolve => setTimeout(resolve, 2000));
        await checkSession();
        
        // One more check after waiting
        await new Promise(resolve => setTimeout(resolve, 1000));
        await checkSession();
        
        // Final check
        if (isAuthenticated) {
          console.log('Session found, redirecting to home');
          navigate("/", { replace: true });
        } else {
          console.error('No session found after callback - authentication failed');
          console.log('Current URL:', window.location.href);
          console.log('Search params:', Object.fromEntries(searchParams.entries()));
          console.log('Hash:', window.location.hash);
          
          navigate("/login2", {
            replace: true,
            state: { error: "Authentication failed. Please try logging in again." }
          });
        }
      } catch (error: any) {
        console.error('Callback error:', error);
        navigate("/login2", {
          replace: true,
          state: { error: error.message || "Authentication failed. Please try again." }
        });
      } finally {
        setIsProcessing(false);
      }
    };

    // Only process once
    if (isProcessing) {
      handleCallback();
    }
  }, [navigate, searchParams, checkSession, isAuthenticated]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="text-center space-y-4">
        <Loader2 className="h-12 w-12 animate-spin text-orange-500 mx-auto" />
        <p className="text-slate-600 dark:text-slate-400">
          Completing authentication...
        </p>
      </div>
    </div>
  );
};

