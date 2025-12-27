import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import { Loader2 } from "lucide-react";

export const AuthCallback = () => {
  const { isLoading, isAuthenticated, error } = useAuth0();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        // User successfully authenticated, redirect to home
        navigate("/", { replace: true });
      } else if (error) {
        // Handle error - redirect back to login
        console.error("Auth error:", error);
        let errorMessage = error.message || "Authentication failed";
        
        // Check for connection not enabled error
        if (error.error === 'invalid_request' || 
            error.message?.includes('connection') || 
            error.message?.includes('not enabled') ||
            error.error_description?.includes('connection')) {
          errorMessage = "Passwordless email connection is not enabled. Please enable it in Auth0 Dashboard: Applications → My App → Connections → Enable 'Email (Passwordless)'";
        } else if (error.message?.includes('email') || 
                   error.message?.includes('sending') || 
                   error.error_description?.includes('email') ||
                   error.error_description?.includes('sending')) {
          errorMessage = "Auth0 email service is not configured. Please configure email sending in Auth0 Dashboard: Branding → Email Provider → Set up SMTP. See FIX_AUTH0_EMAIL_SENDING.md for details.";
        }
        
        navigate("/login", { 
          replace: true,
          state: { error: errorMessage }
        });
      }
    }
  }, [isLoading, isAuthenticated, error, navigate]);

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

