// Example: How to integrate Solana wallet in Admin.tsx
// Add this alongside your existing Ethereum wallet integration

import { SolanaWalletConnect } from '@/components/SolanaWalletConnect';
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { solanaService } from '@/lib/solana';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';

// In your Admin component:

const Admin = () => {
  // ... existing state ...
  const [solanaAddress, setSolanaAddress] = useState<string | null>(null);
  const [isCreatingSolana, setIsCreatingSolana] = useState(false);
  
  // Solana wallet hooks
  const { publicKey, wallet, connection } = useWallet();

  // Initialize Solana service when wallet connects
  useEffect(() => {
    if (publicKey && wallet && connection) {
      const initSolana = async () => {
        try {
          const walletAdapter = {
            publicKey,
            signTransaction: wallet.adapter?.signTransaction?.bind(wallet.adapter),
            signAllTransactions: wallet.adapter?.signAllTransactions?.bind(wallet.adapter),
            signMessage: wallet.adapter?.signMessage?.bind(wallet.adapter),
          };
          
          await solanaService.initialize(
            connection,
            walletAdapter,
            WalletAdapterNetwork.Devnet
          );
        } catch (error) {
          console.error('Solana init failed:', error);
        }
      };
      initSolana();
    }
  }, [publicKey, wallet, connection]);

  // Create batch on Solana
  const handleCreateBatchSolana = async () => {
    if (!publicKey) {
      toast({
        title: 'Error',
        description: 'Please connect your Solana wallet first',
        variant: 'destructive',
      });
      return;
    }

    if (!productName) {
      toast({
        title: 'Error',
        description: 'Product name is required',
        variant: 'destructive',
      });
      return;
    }

    setIsCreatingSolana(true);
    const finalBatchId = batchId || generateBatchId();

    try {
      const tx = await solanaService.createBatch(
        finalBatchId,
        productName,
        sku || '',
        publicKey.toString(), // or use a company address
        baselineImage1 || '/demo/placeholder.jpg',
        baselineImage2 || '/demo/placeholder.jpg',
        publicKey
      );

      toast({
        title: 'Success',
        description: `Batch ${finalBatchId} created on Solana! Transaction: ${tx}`,
      });

      // Reset form
      setProductName('');
      setSku('');
      setBatchId('');
      setBaselineImage1('');
      setBaselineImage2('');
    } catch (error: any) {
      console.error('Batch creation error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create batch on Solana',
        variant: 'destructive',
      });
    } finally {
      setIsCreatingSolana(false);
    }
  };

  return (
    <div>
      {/* Wallet Connect Section */}
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-4xl font-bold">Admin Dashboard</h1>
        <div className="flex gap-4">
          <WalletConnect onAddressChange={setConnectedAddress} />
          <SolanaWalletConnect onAddressChange={setSolanaAddress} />
        </div>
      </div>

      {/* Create Batch Form */}
      <Card>
        {/* ... existing form fields ... */}
        
        <Button
          onClick={handleCreateBatch}
          disabled={!connectedAddress || isCreating}
        >
          {isCreating ? 'Creating on Ethereum...' : 'Create Batch on Ethereum'}
        </Button>

        <Button
          onClick={handleCreateBatchSolana}
          disabled={!publicKey || isCreatingSolana}
          variant="outline"
        >
          {isCreatingSolana ? 'Creating on Solana...' : 'Create Batch on Solana'}
        </Button>
      </Card>
    </div>
  );
};

