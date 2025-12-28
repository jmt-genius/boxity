import { Connection, PublicKey, SystemProgram } from '@solana/web3.js';
import { Program, AnchorProvider, Wallet, BN } from '@coral-xyz/anchor';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import idl from './supply_chain_trust.json';

// Import wallet adapter CSS
import '@solana/wallet-adapter-react-ui/styles.css';

// Types matching the Anchor program
export interface Batch {
  batchId: string;
  productName: string;
  sku: string;
  origin: string;
  firstViewBaseline: string;
  secondViewBaseline: string;
  creator: PublicKey;
  createdAt: number;
  exists: boolean;
}

export interface BatchEvent {
  id: number;
  actor: string;
  role: string;
  note: string;
  firstViewImage: string;
  secondViewImage: string;
  eventHash: string;
  loggedBy: PublicKey;
  timestamp: number;
}

export interface ProgramState {
  owner: PublicKey;
  totalBatches: number;
  nextEventId: number;
}

// Solana Service Class
export class SolanaService {
  private connection: Connection | null = null;
  private provider: AnchorProvider | null = null;
  private program: Program | null = null;
  private network: WalletAdapterNetwork = WalletAdapterNetwork.Devnet;

  // Program ID - Replace with your deployed program ID
  private readonly PROGRAM_ID = new PublicKey('YourProgramIdHere');
  
  // Network RPC endpoints
  private readonly RPC_ENDPOINTS = {
    [WalletAdapterNetwork.Devnet]: 'https://api.devnet.solana.com',
    [WalletAdapterNetwork.Testnet]: 'https://api.testnet.solana.com',
    [WalletAdapterNetwork.Mainnet]: 'https://api.mainnet-beta.solana.com',
  };

  async initialize(
    connection: Connection,
    wallet: { publicKey: PublicKey; signTransaction?: any; signAllTransactions?: any; signMessage?: any },
    network: WalletAdapterNetwork = WalletAdapterNetwork.Devnet
  ) {
    try {
      this.network = network;
      this.connection = connection;
      
      // Create a wallet adapter wrapper for Anchor
      const anchorWallet: Wallet = {
        publicKey: wallet.publicKey,
        signTransaction: wallet.signTransaction,
        signAllTransactions: wallet.signAllTransactions,
        signMessage: wallet.signMessage,
      };
      
      this.provider = new AnchorProvider(
        this.connection,
        anchorWallet,
        { commitment: 'confirmed' }
      );
      
      this.program = new Program(idl as any, this.PROGRAM_ID, this.provider);
      
      console.log('Solana service initialized:', {
        network,
        programId: this.PROGRAM_ID.toString(),
      });
    } catch (error) {
      console.error('Failed to initialize Solana service:', error);
      throw error;
    }
  }

  getConnection(): Connection {
    if (!this.connection) {
      throw new Error('Solana service not initialized');
    }
    return this.connection;
  }

  getProgram(): Program {
    if (!this.program) {
      throw new Error('Solana program not initialized');
    }
    return this.program;
  }

  getProvider(): AnchorProvider {
    if (!this.provider) {
      throw new Error('Solana provider not initialized');
    }
    return this.provider;
  }

  // Derive PDA for program state
  async getProgramStatePDA(): Promise<[PublicKey, number]> {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('program_state')],
      this.PROGRAM_ID
    );
  }

  // Derive PDA for batch
  async getBatchPDA(batchId: string): Promise<[PublicKey, number]> {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('batch'), Buffer.from(batchId)],
      this.PROGRAM_ID
    );
  }

  // Derive PDA for event
  async getEventPDA(batchPDA: PublicKey, eventId: number): Promise<[PublicKey, number]> {
    const eventIdBuffer = Buffer.allocUnsafe(8);
    eventIdBuffer.writeBigUInt64LE(BigInt(eventId), 0);
    return PublicKey.findProgramAddressSync(
      [Buffer.from('event'), batchPDA.toBuffer(), eventIdBuffer],
      this.PROGRAM_ID
    );
  }

  // Derive PDA for user authorization
  async getUserAuthorizationPDA(user: PublicKey): Promise<[PublicKey, number]> {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('user_auth'), user.toBuffer()],
      this.PROGRAM_ID
    );
  }

  // Initialize program (first time setup)
  async initializeProgram(owner: PublicKey): Promise<string> {
    const program = this.getProgram();
    const [programStatePDA] = await this.getProgramStatePDA();

    try {
      const tx = await program.methods
        .initialize()
        .accounts({
          programState: programStatePDA,
          owner: owner,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      return tx;
    } catch (error) {
      console.error('Failed to initialize program:', error);
      throw error;
    }
  }

  // Create batch
  async createBatch(
    batchId: string,
    productName: string,
    sku: string,
    origin: string,
    firstViewBaseline: string,
    secondViewBaseline: string,
    creator: PublicKey
  ): Promise<string> {
    const program = this.getProgram();
    const [batchPDA] = await this.getBatchPDA(batchId);
    const [programStatePDA] = await this.getProgramStatePDA();

    try {
      const tx = await program.methods
        .createBatch(
          batchId,
          productName,
          sku,
          origin,
          firstViewBaseline,
          secondViewBaseline
        )
        .accounts({
          batch: batchPDA,
          programState: programStatePDA,
          creator: creator,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      return tx;
    } catch (error) {
      console.error('Failed to create batch:', error);
      throw error;
    }
  }

  // Log event
  async logEvent(
    batchId: string,
    actor: string,
    role: string,
    note: string,
    firstViewImage: string,
    secondViewImage: string,
    eventHash: string,
    logger: PublicKey
  ): Promise<string> {
    const program = this.getProgram();
    const [batchPDA] = await this.getBatchPDA(batchId);
    const [programStatePDA, programStateBump] = await this.getProgramStatePDA();
    
    // Get current next_event_id from program state
    const programState = await program.account.programState.fetch(programStatePDA);
    const eventId = programState.nextEventId.toNumber();
    
    const [eventPDA] = await this.getEventPDA(batchPDA, eventId);

    try {
      const tx = await program.methods
        .logEvent(
          actor,
          role,
          note,
          firstViewImage,
          secondViewImage,
          eventHash
        )
        .accounts({
          batch: batchPDA,
          event: eventPDA,
          programState: programStatePDA,
          logger: logger,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      return tx;
    } catch (error) {
      console.error('Failed to log event:', error);
      throw error;
    }
  }

  // Get batch
  async getBatch(batchId: string): Promise<Batch | null> {
    const program = this.getProgram();
    const [batchPDA] = await this.getBatchPDA(batchId);

    try {
      const batch = await program.account.batch.fetch(batchPDA);
      
      return {
        batchId: batch.batchId,
        productName: batch.productName,
        sku: batch.sku,
        origin: batch.origin,
        firstViewBaseline: batch.firstViewBaseline,
        secondViewBaseline: batch.secondViewBaseline,
        creator: batch.creator,
        createdAt: batch.createdAt.toNumber(),
        exists: batch.exists,
      };
    } catch (error) {
      console.error('Failed to fetch batch:', error);
      return null;
    }
  }

  // Get all batches (fetch all batch accounts)
  async getAllBatches(): Promise<Batch[]> {
    const program = this.getProgram();
    
    try {
      const batches = await program.account.batch.all();
      
      return batches.map((batch) => ({
        batchId: batch.account.batchId,
        productName: batch.account.productName,
        sku: batch.account.sku,
        origin: batch.account.origin,
        firstViewBaseline: batch.account.firstViewBaseline,
        secondViewBaseline: batch.account.secondViewBaseline,
        creator: batch.account.creator,
        createdAt: batch.account.createdAt.toNumber(),
        exists: batch.account.exists,
      }));
    } catch (error) {
      console.error('Failed to fetch batches:', error);
      return [];
    }
  }

  // Get batch events
  async getBatchEvents(batchId: string): Promise<BatchEvent[]> {
    const program = this.getProgram();
    const [batchPDA] = await this.getBatchPDA(batchId);

    try {
      const events = await program.account.batchEvent.all([
        {
          memcmp: {
            offset: 8 + 32, // Skip discriminator and batch pubkey
            bytes: batchPDA.toBase58(),
          },
        },
      ]);

      return events.map((event) => ({
        id: event.account.id.toNumber(),
        actor: event.account.actor,
        role: event.account.role,
        note: event.account.note,
        firstViewImage: event.account.firstViewImage,
        secondViewImage: event.account.secondViewImage,
        eventHash: event.account.eventHash,
        loggedBy: event.account.loggedBy,
        timestamp: event.account.timestamp.toNumber(),
      }));
    } catch (error) {
      console.error('Failed to fetch batch events:', error);
      return [];
    }
  }

  // Check if user is authorized
  async isUserAuthorized(user: PublicKey): Promise<boolean> {
    const program = this.getProgram();
    const [programStatePDA] = await this.getProgramStatePDA();

    try {
      const programState = await program.account.programState.fetch(programStatePDA);
      
      // Check if user is owner
      if (user.equals(programState.owner)) {
        return true;
      }

      // Check user authorization account
      const [userAuthPDA] = await this.getUserAuthorizationPDA(user);
      try {
        const userAuth = await program.account.userAuthorization.fetch(userAuthPDA);
        return userAuth.authorized;
      } catch {
        return false;
      }
    } catch (error) {
      console.error('Failed to check authorization:', error);
      return false;
    }
  }

  // Set user authorization
  async setUserAuthorization(
    user: PublicKey,
    authorized: boolean,
    owner: PublicKey
  ): Promise<string> {
    const program = this.getProgram();
    const [programStatePDA] = await this.getProgramStatePDA();
    const [userAuthPDA] = await this.getUserAuthorizationPDA(user);

    try {
      const tx = await program.methods
        .setUserAuthorization(user, authorized)
        .accounts({
          programState: programStatePDA,
          userAuthorization: userAuthPDA,
          owner: owner,
          user: user,
          systemProgram: SystemProgram.programId,
        })
        .rpc();

      return tx;
    } catch (error) {
      console.error('Failed to set user authorization:', error);
      throw error;
    }
  }

  // Get program state
  async getProgramState(): Promise<ProgramState | null> {
    const program = this.getProgram();
    const [programStatePDA] = await this.getProgramStatePDA();

    try {
      const state = await program.account.programState.fetch(programStatePDA);
      
      return {
        owner: state.owner,
        totalBatches: state.totalBatches.toNumber(),
        nextEventId: state.nextEventId.toNumber(),
      };
    } catch (error) {
      console.error('Failed to fetch program state:', error);
      return null;
    }
  }
}

// Global instance
export const solanaService = new SolanaService();

