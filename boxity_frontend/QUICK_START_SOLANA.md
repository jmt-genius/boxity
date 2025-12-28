# Quick Start: Solana Integration

## Step-by-Step Setup

### 1. Install Prerequisites

```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install Solana CLI
sh -c "$(curl -sSfL https://release.solana.com/stable/install)"

# Install Anchor
cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
avm install latest
avm use latest
```

### 2. Set Up Anchor Project

```bash
cd boxity_frontend
anchor init solana-program --name supply-chain-trust
cd solana-program
```

### 3. Replace Program Files

- Copy `lib.rs` to `programs/supply-chain-trust/src/lib.rs`
- Update `Anchor.toml` with your configuration
- Update `Cargo.toml` if needed

### 4. Generate Program Keypair

```bash
anchor keys list
# Copy the program ID and update:
# - Anchor.toml
# - lib.rs (declare_id!)
# - src/lib/solana.ts (PROGRAM_ID)
```

### 5. Build Program

```bash
anchor build
```

This will generate the IDL in `target/idl/supply_chain_trust.json`

### 6. Copy IDL to Frontend

```bash
cp target/idl/supply_chain_trust.json ../src/lib/supply-chain-trust.json
```

Or use the template file and update the program ID.

### 7. Deploy to Devnet

```bash
# Set to devnet
solana config set --url devnet

# Airdrop SOL
solana airdrop 2

# Deploy
anchor deploy
```

### 8. Install Frontend Dependencies

```bash
cd boxity_frontend
npm install @solana/web3.js @coral-xyz/anchor @solana/wallet-adapter-base @solana/wallet-adapter-react @solana/wallet-adapter-react-ui @solana/wallet-adapter-wallets
```

### 9. Update App.tsx

Wrap your app with Solana providers:

```tsx
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { PhantomWalletAdapter, SolflareWalletAdapter } from '@solana/wallet-adapter-wallets';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import { useMemo } from 'react';
import '@solana/wallet-adapter-react-ui/styles.css';

// In your App component:
const network = WalletAdapterNetwork.Devnet;
const endpoint = useMemo(() => {
  if (network === WalletAdapterNetwork.Devnet) {
    return 'https://api.devnet.solana.com';
  }
  return 'https://api.mainnet-beta.solana.com';
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
        {/* Your existing app */}
      </WalletModalProvider>
    </WalletProvider>
  </ConnectionProvider>
);
```

### 10. Add Solana Wallet Button to Admin Page

```tsx
import { SolanaWalletConnect } from '@/components/SolanaWalletConnect';

// In Admin component, add alongside Ethereum wallet:
<div className="flex gap-4">
  <WalletConnect onAddressChange={setConnectedAddress} />
  <SolanaWalletConnect onAddressChange={setSolanaAddress} />
</div>
```

### 11. Initialize Program (One Time)

Before using, initialize the program:

```tsx
const { publicKey } = useWallet();
const { connection } = useConnection();

const initializeProgram = async () => {
  if (!publicKey) return;
  
  try {
    const tx = await solanaService.initializeProgram(publicKey);
    console.log('Initialized:', tx);
  } catch (error) {
    console.error('Init failed:', error);
  }
};
```

### 12. Test

1. Connect Phantom/Solflare wallet
2. Switch to Devnet in wallet
3. Initialize program (first time only)
4. Create a batch
5. Log an event

## Deployment Checklist

- [ ] Program built successfully
- [ ] Program ID updated in all files
- [ ] IDL copied to frontend
- [ ] Program deployed to devnet
- [ ] Frontend dependencies installed
- [ ] Wallet providers added to App.tsx
- [ ] Program initialized
- [ ] Test batch creation
- [ ] Test event logging

## Production Deployment

1. Switch to mainnet in `Anchor.toml`
2. Update network in `App.tsx` to `WalletAdapterNetwork.Mainnet`
3. Rebuild and redeploy:
   ```bash
   anchor build
   anchor deploy
   ```
4. Update program ID if it changed
5. Test thoroughly on mainnet

