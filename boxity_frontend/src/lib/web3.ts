import { ethers } from 'ethers';
import CoinbaseWalletSDK from '@coinbase/wallet-sdk';
import { CONTRACT_ADDRESS, CONTRACT_ABI, NETWORKS, SUPPORTED_NETWORKS } from './contracts';

// Types
export interface Batch {
  id: string;
  productName: string;
  sku: string;
  origin: string;
  createdAt: string; // ISO string
  firstViewBaseline: string;
  secondViewBaseline: string;
  creator: string;
  exists: boolean;
}

export interface BatchEvent {
  id: number;
  actor: string;
  role: string;
  timestamp: number;
  note: string;
  firstViewImage: string;
  secondViewImage: string;
  eventHash: string;
  loggedBy: string;
}

export interface ContractInfo {
  name: string;
  version: string;
  contractOwner: string;
  totalBatchesCount: number;
  nextEventIdValue: number;
}

// Web3 Provider Management
export class Web3Service {
  private provider: ethers.BrowserProvider | null = null;
  private signer: ethers.JsonRpcSigner | null = null;
  private contract: ethers.Contract | null = null;
  private coinbaseProvider: any = null;

  constructor() {
    const coinbaseWallet = new CoinbaseWalletSDK({
      appName: 'Boxity',
      appLogoUrl: window.location.origin + '/favicon.ico',
    });

    this.coinbaseProvider = coinbaseWallet.makeWeb3Provider();
  }

  async connectWallet(): Promise<string> {
    try {
      // Request account access through Coinbase Wallet
      await this.coinbaseProvider.request({ method: 'eth_requestAccounts' });

      // Create provider
      this.provider = new ethers.BrowserProvider(this.coinbaseProvider);

      // Get signer
      this.signer = await this.provider.getSigner();

      // Ensure contract address is a valid checksummed address (prevents ENS resolution)
      let contractAddress: string;
      try {
        contractAddress = ethers.getAddress(CONTRACT_ADDRESS);
      } catch {
        // If getAddress fails, use the address as-is (shouldn't happen with valid address)
        contractAddress = CONTRACT_ADDRESS;
      }

      // Initialize contract with explicit hex address (no ENS resolution)
      this.contract = new ethers.Contract(contractAddress, CONTRACT_ABI, this.signer);

      // Get address directly without ENS resolution
      const address = await this.signer.getAddress();

      // Check if we're on the correct network
      await this.checkNetwork();

      return address;
    } catch (error) {
      console.error('Wallet connection error:', error);
      throw error;
    }
  }

  async checkNetwork(): Promise<void> {
    if (!this.provider) return;

    const network = await this.provider.getNetwork();
    const targetChainId = parseInt(NETWORKS.SEPOLIA.chainId, 16);

    if (network.chainId !== BigInt(targetChainId)) {
      await this.switchToSepolia();
    }
  }

  async switchToSepolia(): Promise<void> {
    try {
      await this.coinbaseProvider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: NETWORKS.SEPOLIA.chainId }],
      });
    } catch (switchError: any) {
      // This error code indicates that the chain has not been added to MetaMask
      if (switchError.code === 4902) {
        await this.addSepoliaNetwork();
      } else {
        throw switchError;
      }
    }
  }

  private async addSepoliaNetwork(): Promise<void> {
    await this.coinbaseProvider.request({
      method: 'wallet_addEthereumChain',
      params: [
        {
          chainId: NETWORKS.SEPOLIA.chainId,
          chainName: NETWORKS.SEPOLIA.chainName,
          rpcUrls: NETWORKS.SEPOLIA.rpcUrls,
          blockExplorerUrls: NETWORKS.SEPOLIA.blockExplorerUrls,
          nativeCurrency: {
            name: 'ETH',
            symbol: 'ETH',
            decimals: 18,
          },
        },
      ],
    });
  }

  async getConnectedAddress(): Promise<string | null> {
    if (!this.signer) return null;
    return await this.signer.getAddress();
  }

  async isUserAuthorized(address: string): Promise<boolean> {
    if (!this.contract) throw new Error('Contract not initialized');
    // Ensure address is a valid hex address (not ENS) to prevent resolution errors
    const normalizedAddress = ethers.isAddress(address)
      ? ethers.getAddress(address)
      : address;
    return await this.contract.isUserAuthorized(normalizedAddress);
  }

  // Contract Functions
  async createBatch(
    batchId: string,
    productName: string,
    sku: string,
    origin: string,
    firstViewBaseline: string,
    secondViewBaseline: string
  ): Promise<ethers.ContractTransactionResponse> {
    if (!this.contract) throw new Error('Contract not initialized');

    return await this.contract.createBatch(
      batchId,
      productName,
      sku,
      origin,
      firstViewBaseline,
      secondViewBaseline
    );
  }

  async getBatch(batchId: string): Promise<Batch> {
    if (!this.contract) throw new Error('Contract not initialized');

    const batch = await this.contract.getBatch(batchId);

    return {
      id: batch.id,
      productName: batch.productName,
      sku: batch.sku,
      origin: batch.origin,
      createdAt: new Date(Number(batch.createdAt) * 1000).toISOString(),
      firstViewBaseline: batch.firstViewBaseline,
      secondViewBaseline: batch.secondViewBaseline,
      creator: batch.creator,
      exists: batch.exists
    };
  }

  async getAllBatchIds(): Promise<string[]> {
    if (!this.contract) throw new Error('Contract not initialized');
    return await this.contract.getAllBatchIds();
  }

  async getBatchEvents(batchId: string): Promise<BatchEvent[]> {
    if (!this.contract) throw new Error('Contract not initialized');

    const events = await this.contract.getBatchEvents(batchId);

    return events.map((event: any) => ({
      id: Number(event.id),
      actor: event.actor,
      role: event.role,
      timestamp: Number(event.timestamp),
      note: event.note,
      firstViewImage: event.firstViewImage,
      secondViewImage: event.secondViewImage,
      eventHash: event.eventHash,
      loggedBy: event.loggedBy
    }));
  }

  async getContractInfo(): Promise<ContractInfo> {
    if (!this.contract) throw new Error('Contract not initialized');

    const info = await this.contract.getContractInfo();

    return {
      name: info.name,
      version: info.version,
      contractOwner: info.contractOwner,
      totalBatchesCount: Number(info.totalBatchesCount),
      nextEventIdValue: Number(info.nextEventIdValue)
    };
  }

  async logEvent(
    batchId: string,
    actor: string,
    role: string,
    note: string,
    firstViewImage: string,
    secondViewImage: string,
    eventHash: string
  ): Promise<ethers.ContractTransactionResponse> {
    if (!this.contract) throw new Error('Contract not initialized');

    return await this.contract.logEvent(
      batchId,
      actor,
      role,
      note,
      firstViewImage,
      secondViewImage,
      eventHash
    );
  }

  // Utility functions
  async waitForTransaction(tx: ethers.ContractTransactionResponse): Promise<ethers.TransactionReceipt | null> {
    if (!this.provider) throw new Error('Provider not initialized');
    return await tx.wait();
  }

  disconnect(): void {
    this.provider = null;
    this.signer = null;
    this.contract = null;
  }
}

// Global instance
export const web3Service = new Web3Service();

// Declare window.ethereum for TypeScript
declare global {
  interface Window {
    ethereum?: any;
  }
}
