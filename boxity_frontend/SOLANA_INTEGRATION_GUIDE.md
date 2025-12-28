# Solana Integration Guide for Supply Chain Trust

This guide will walk you through integrating Solana blockchain support into your Supply Chain Trust application.

## Prerequisites

1. **Install Rust**: https://rustup.rs/
2. **Install Solana CLI**: https://docs.solana.com/cli/install-solana-cli-tools
3. **Install Anchor Framework**: 
   ```bash
   cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
   avm install latest
   avm use latest
   ```

## Step 1: Set Up Anchor Project

1. **Create Anchor project** (if not already created):
   ```bash
   cd boxity_frontend
   anchor init solana-program --name supply-chain-trust
   cd solana-program
   ```

2. **Replace the default program** with the provided `lib.rs` file in `programs/supply-chain-trust/src/lib.rs`

3. **Update Anchor.toml**:
   - Set your cluster (devnet, mainnet, or localnet)
   - Update program ID after deployment

## Step 2: Build and Deploy the Program

### For Devnet (Testing):

1. **Generate a new keypair** (if you don't have one):
   ```bash
   solana-keygen new
   ```

2. **Set Solana CLI to devnet**:
   ```bash
   solana config set --url devnet
   ```

3. **Airdrop SOL** (for devnet):
   ```bash
   solana airdrop 2 $(solana address)
   ```

4. **Build the program**:
   ```bash
   anchor build
   ```

5. **Deploy the program**:
   ```bash
   anchor deploy
   ```

6. **Copy the Program ID** from the output and update:
   - `Anchor.toml` - Replace `YourProgramIdHere` with your actual program ID
   - `lib.rs` - Update `declare_id!()` with your program ID
   - `src/lib/solana.ts` - Update `PROGRAM_ID` constant

### For Mainnet (Production):

1. **Set to mainnet**:
   ```bash
   solana config set --url mainnet-beta
   ```

2. **Build and deploy** (same as devnet):
   ```bash
   anchor build
   anchor deploy
   ```

## Step 3: Generate TypeScript IDL

After building, generate the TypeScript IDL:

```bash
anchor idl parse -f programs/supply-chain-trust/src/lib.rs -o src/lib/supply-chain-trust.json
```

Or copy the IDL from `target/idl/supply_chain_trust.json` to `src/lib/supply-chain-trust.json`

## Step 4: Install Frontend Dependencies

```bash
cd boxity_frontend
npm install @solana/web3.js @coral-xyz/anchor @solana/wallet-adapter-base @solana/wallet-adapter-react @solana/wallet-adapter-react-ui @solana/wallet-adapter-wallets
```

## Step 5: Set Up Wallet Provider

Update your `App.tsx` or main entry point:

```tsx
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { useMemo } from 'react';
import '@solana/wallet-adapter-react-ui/styles.css';

function App() {
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
          {/* Your app components */}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
```

## Step 6: Initialize Program (First Time)

Before using the program, you need to initialize it once:

```typescript
// In Admin.tsx or a setup component
const initializeSolanaProgram = async () => {
  if (!publicKey) return;
  
  try {
    const tx = await solanaService.initializeProgram(publicKey);
    console.log('Program initialized:', tx);
    toast({
      title: 'Success',
      description: 'Solana program initialized!',
    });
  } catch (error) {
    console.error('Initialization failed:', error);
  }
};
```

## Step 7: Update Admin Page

Add Solana wallet connect button alongside Ethereum:

```tsx
import { SolanaWalletConnect } from '@/components/SolanaWalletConnect';
import { solanaService } from '@/lib/solana';
import { useWallet } from '@solana/wallet-adapter-react';

// In your Admin component:
const { publicKey } = useWallet();
const [solanaAddress, setSolanaAddress] = useState<string | null>(null);

// Update createBatch function:
const handleCreateBatchSolana = async () => {
  if (!publicKey) {
    toast({
      title: 'Error',
      description: 'Please connect your Solana wallet first',
      variant: 'destructive',
    });
    return;
  }

  setIsCreating(true);
  const finalBatchId = batchId || generateBatchId();

  try {
    const tx = await solanaService.createBatch(
      finalBatchId,
      productName,
      sku || "",
      publicKey.toString(), // or use a company address
      baselineImage1 || "/demo/placeholder.jpg",
      baselineImage2 || "/demo/placeholder.jpg",
      publicKey
    );

    toast({
      title: 'Success',
      description: `Batch ${finalBatchId} created on Solana!`,
    });

    // Reset form...
  } catch (error: any) {
    toast({
      title: 'Error',
      description: error.message || 'Failed to create batch on Solana',
      variant: 'destructive',
    });
  } finally {
    setIsCreating(false);
  }
};
```

## Step 8: Update LogEvent Page

Similarly update LogEvent to support Solana:

```tsx
const handleSubmitSolana = async () => {
  if (!publicKey) {
    toast({
      title: 'Wallet Required',
      description: 'Please connect your Solana wallet',
      variant: 'destructive',
    });
    return;
  }

  setIsLogging(true);
  try {
    const eventHash = generateHash(`${batchId}${actor}${Date.now()}`);
    
    const tx = await solanaService.logEvent(
      batchId,
      actor,
      role,
      note,
      imageAngle1 || '',
      imageAngle2 || '',
      eventHash,
      publicKey
    );

    toast({
      title: 'Event Logged Successfully',
      description: 'Event has been recorded on Solana!',
    });
  } catch (error: any) {
    toast({
      title: 'Error',
      description: error.message || 'Failed to log event on Solana',
      variant: 'destructive',
    });
  } finally {
    setIsLogging(false);
  }
};
```

## Step 9: Testing

1. **Test on Devnet**:
   - Connect Phantom or Solflare wallet
   - Switch to Devnet in wallet
   - Test batch creation and event logging

2. **Verify Transactions**:
   - Check transactions on Solana Explorer: https://explorer.solana.com/?cluster=devnet
   - Verify program accounts are created correctly

## Step 10: Production Deployment

1. **Update to Mainnet**:
   - Change network in `App.tsx` to `WalletAdapterNetwork.Mainnet`
   - Update RPC endpoint to mainnet
   - Rebuild and redeploy program

2. **Update Program ID**:
   - Update all references to your mainnet program ID

3. **Security**:
   - Review access controls
   - Test thoroughly before mainnet deployment

## Troubleshooting

### Common Issues:

1. **"Program account not found"**:
   - Make sure program is deployed
   - Check program ID matches in all files

2. **"Insufficient funds"**:
   - Airdrop more SOL on devnet
   - Ensure wallet has enough SOL for transactions

3. **"Invalid account"**:
   - Verify PDA derivation is correct
   - Check account initialization

4. **IDL not found**:
   - Make sure `supply-chain-trust.json` is in `src/lib/`
   - Regenerate IDL after contract changes

## Additional Resources

- [Solana Documentation](https://docs.solana.com/)
- [Anchor Documentation](https://www.anchor-lang.com/)
- [Solana Cookbook](https://solanacookbook.com/)
- [Wallet Adapter Docs](https://github.com/solana-labs/wallet-adapter)

## Notes

- Solana uses PDAs (Program Derived Addresses) instead of mappings
- Account space must be calculated and specified
- Transactions require rent (SOL) for account creation
- Events are emitted differently than Ethereum

