// Updated App.tsx with Solana integration
// Replace your existing App.tsx with this structure

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

// Solana imports
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { useMemo } from 'react';
import '@solana/wallet-adapter-react-ui/styles.css';

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
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
};

const App = () => {
  // Solana configuration
  const network = WalletAdapterNetwork.Devnet; // Change to Mainnet for production
  
  const endpoint = useMemo(() => {
    if (network === WalletAdapterNetwork.Devnet) {
      return 'https://api.devnet.solana.com';
    } else if (network === WalletAdapterNetwork.Mainnet) {
      return 'https://api.mainnet-beta.solana.com';
    }
    return 'https://api.testnet.solana.com';
  }, [network]);

  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
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
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};

export default App;

