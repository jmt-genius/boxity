import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { LogOut } from 'lucide-react';
import { 
  useWallet,
  useConnection,
} from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { solanaService } from '@/lib/solana';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';

interface SolanaWalletConnectProps {
  onAddressChange: (address: string | null) => void;
}

export const SolanaWalletConnect = ({ onAddressChange }: SolanaWalletConnectProps) => {
  const { toast } = useToast();
  const { wallet, publicKey, disconnect, connecting } = useWallet();
  const { connection } = useConnection();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(false);

  // Initialize Solana service when wallet connects
  useEffect(() => {
    if (publicKey && wallet && wallet.adapter && connection) {
      const initializeService = async () => {
        try {
          // Create a wallet adapter wrapper
          const walletAdapter = {
            publicKey: publicKey,
            signTransaction: wallet.adapter.signTransaction?.bind(wallet.adapter),
            signAllTransactions: wallet.adapter.signAllTransactions?.bind(wallet.adapter),
            signMessage: wallet.adapter.signMessage?.bind(wallet.adapter),
          };

          await solanaService.initialize(
            connection,
            walletAdapter,
            WalletAdapterNetwork.Devnet // Change to Mainnet for production
          );

          onAddressChange(publicKey.toString());
          
          // Check authorization
          setIsCheckingAuth(true);
          const authorized = await solanaService.isUserAuthorized(publicKey);
          setIsAuthorized(authorized);
          setIsCheckingAuth(false);

          toast({
            title: 'Solana Wallet Connected',
            description: `Connected to ${publicKey.toString().slice(0, 6)}...${publicKey.toString().slice(-4)}`,
          });
        } catch (error: any) {
          console.error('Failed to initialize Solana service:', error);
          toast({
            title: 'Connection Failed',
            description: error.message || 'Failed to connect Solana wallet',
            variant: 'destructive',
          });
        }
      };

      initializeService();
    } else {
      onAddressChange(null);
      setIsAuthorized(false);
    }
  }, [publicKey, wallet, connection, onAddressChange, toast]);

  const handleDisconnect = async () => {
    try {
      await disconnect();
      onAddressChange(null);
      setIsAuthorized(false);
      
      toast({
        title: 'Wallet Disconnected',
        description: 'You have been disconnected from your Solana wallet',
      });
    } catch (error) {
      console.error('Failed to disconnect:', error);
    }
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  if (publicKey) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Badge variant={isAuthorized ? "default" : "secondary"}>
            {isCheckingAuth ? "Checking..." : isAuthorized ? "Authorized" : "Not Authorized"}
          </Badge>
          <span className="text-sm font-mono">{formatAddress(publicKey.toString())}</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDisconnect}
          className="flex items-center gap-2"
        >
          <LogOut className="h-4 w-4" />
          Disconnect
        </Button>
      </div>
    );
  }

  return (
    <WalletMultiButton className="!bg-primary !text-primary-foreground hover:!bg-primary/90" />
  );
};

