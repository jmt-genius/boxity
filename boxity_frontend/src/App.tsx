import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Auth0Provider } from "@auth0/auth0-react";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider, AUTH0_CONFIG, useAuth } from "@/contexts/AuthContext";
import { Navbar } from "@/components/Navbar";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Admin from "./pages/Admin";
import LogEvent from "./pages/LogEvent";
import Verify from "./pages/Verify";
import IntegrityCheck from "./pages/IntegrityCheck";
import Login from "./pages/Login";
import { AuthCallback } from "./components/AuthCallback";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const AppRoutes = () => {
  const { isAuthenticated } = useAuth();

  return (
    <BrowserRouter>
      {isAuthenticated && <Navbar />}
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/callback" element={<AuthCallback />} />
        <Route path="/" element={<Index />} />
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <Admin />
            </ProtectedRoute>
          }
        />
        <Route
          path="/log-event"
          element={
            <ProtectedRoute>
              <LogEvent />
            </ProtectedRoute>
          }
        />
        <Route path="/verify" element={<Verify />} />
        <Route path="/integrity-check" element={<IntegrityCheck />} />
        {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
};

const App = () => (
  <Auth0Provider
    domain={AUTH0_CONFIG.domain}
    clientId={AUTH0_CONFIG.clientId}
    authorizationParams={{
      ...(AUTH0_CONFIG.audience && { audience: AUTH0_CONFIG.audience }),
      redirect_uri: `${window.location.origin}/callback`,
      scope: "openid profile email offline_access",
    }}
    useRefreshTokens={true}
    cacheLocation="localstorage"
    onRedirectCallback={(appState) => {
      // Handle redirect after Auth0 callback
      window.history.replaceState({}, document.title, appState?.returnTo || window.location.origin);
    }}
  >
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <AppRoutes />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  </Auth0Provider>
);

export default App;
