import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { web3Service } from '@/lib/web3';
import { Wallet, LogOut } from 'lucide-react';

interface WalletConnectProps {
  onAddressChange: (address: string | null) => void;
}

export const WalletConnect = ({ onAddressChange }: WalletConnectProps) => {
  const { toast } = useToast();
  const [address, setAddress] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    // Check if already connected
    checkConnection();
  }, []);

  const checkConnection = async () => {
    try {
      const connectedAddress = await web3Service.getConnectedAddress();
      if (connectedAddress) {
        setAddress(connectedAddress);
        onAddressChange(connectedAddress);
        
        // Check if user is authorized
        const authorized = await web3Service.isUserAuthorized(connectedAddress);
        setIsAuthorized(authorized);
      }
    } catch (error) {
      console.error('Connection check error:', error);
    }
  };

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const connectedAddress = await web3Service.connectWallet();
      setAddress(connectedAddress);
      onAddressChange(connectedAddress);
      
      // Check authorization
      const authorized = await web3Service.isUserAuthorized(connectedAddress);
      setIsAuthorized(authorized);
      
      toast({
        title: 'Wallet Connected',
        description: `Connected to ${connectedAddress.slice(0, 6)}...${connectedAddress.slice(-4)}`,
      });
    } catch (error: any) {
      console.error('Connection error:', error);
      toast({
        title: 'Connection Failed',
        description: error.message || 'Failed to connect wallet',
        variant: 'destructive',
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    web3Service.disconnect();
    setAddress(null);
    setIsAuthorized(false);
    onAddressChange(null);
    
    toast({
      title: 'Wallet Disconnected',
      description: 'You have been disconnected from your wallet',
    });
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  if (address) {
    return (
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <Badge variant={isAuthorized ? "default" : "secondary"}>
            {isAuthorized ? "Authorized" : "Not Authorized"}
          </Badge>
          <span className="text-sm font-mono">{formatAddress(address)}</span>
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
    <Button
      onClick={handleConnect}
      disabled={isConnecting}
      className="flex items-center gap-2"
    >
      <Wallet className="h-4 w-4" />
      {isConnecting ? 'Connecting...' : 'Connect Wallet'}
    </Button>
  );
};
