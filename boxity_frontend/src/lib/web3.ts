import { ethers } from 'ethers';
import { CONTRACT_ADDRESS, CONTRACT_ABI, NETWORKS, SUPPORTED_NETWORKS } from './contracts';

// Types
export interface Batch {
  id: string;
  productName: string;
  sku: string;
  origin: string;
  createdAt: string; // ISO string
  baselineImage: string;
  creator: string;
  exists: boolean;
}

export interface BatchEvent {
  id: number;
  actor: string;
  role: string;
  timestamp: number;
  note: string;
  image: string;
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

  async connectWallet(): Promise<string> {
    try {
      if (!window.ethereum) {
        throw new Error('MetaMask or compatible wallet not found');
      }

      // Request account access
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      
      this.provider = new ethers.BrowserProvider(window.ethereum);
      this.signer = await this.provider.getSigner();
      
      // Initialize contract
      this.contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, this.signer);
      
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
    const targetChainId = parseInt(NETWORKS.BASE_SEPOLIA.chainId, 16);
    
    if (network.chainId !== BigInt(targetChainId)) {
      await this.switchToBaseSepolia();
    }
  }

  async switchToBaseSepolia(): Promise<void> {
    try {
      await window.ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: NETWORKS.BASE_SEPOLIA.chainId }],
      });
    } catch (switchError: any) {
      // This error code indicates that the chain has not been added to MetaMask
      if (switchError.code === 4902) {
        await this.addBaseSepoliaNetwork();
      } else {
        throw switchError;
      }
    }
  }

  private async addBaseSepoliaNetwork(): Promise<void> {
    await window.ethereum.request({
      method: 'wallet_addEthereumChain',
      params: [
        {
          chainId: NETWORKS.BASE_SEPOLIA.chainId,
          chainName: NETWORKS.BASE_SEPOLIA.chainName,
          rpcUrls: NETWORKS.BASE_SEPOLIA.rpcUrls,
          blockExplorerUrls: NETWORKS.BASE_SEPOLIA.blockExplorerUrls,
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
    return await this.contract.isUserAuthorized(address);
  }

  // Contract Functions
  async createBatch(
    batchId: string,
    productName: string,
    sku: string,
    origin: string,
    baselineImage: string
  ): Promise<ethers.ContractTransactionResponse> {
    if (!this.contract) throw new Error('Contract not initialized');
    
    return await this.contract.createBatch(
      batchId,
      productName,
      sku,
      origin,
      baselineImage
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
      baselineImage: batch.baselineImage,
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
      image: event.image,
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
    image: string,
    eventHash: string
  ): Promise<ethers.ContractTransactionResponse> {
    if (!this.contract) throw new Error('Contract not initialized');
    
    return await this.contract.logEvent(
      batchId,
      actor,
      role,
      note,
      image,
      eventHash
    );
  }

  // Utility functions
  async waitForTransaction(tx: ethers.ContractTransactionResponse): Promise<ethers.ContractReceipt | null> {
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
