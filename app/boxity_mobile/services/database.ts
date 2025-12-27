import { createClient } from '@insforge/sdk';

const INSFORGE_BASE_URL = process.env.EXPO_PUBLIC_INSFORGE_BASE_URL || '';

class DatabaseService {
  private client: ReturnType<typeof createClient> | null = null;

  private getClient() {
    if (!this.client) {
      if (!INSFORGE_BASE_URL) {
        const errorMsg = 'INSFORGE_BASE_URL is not configured. Please set EXPO_PUBLIC_INSFORGE_BASE_URL';
        console.error('Database:', errorMsg);
        throw new Error(errorMsg);
      }

      console.log('Database: Initializing client with baseUrl:', INSFORGE_BASE_URL);

      this.client = createClient({
        baseUrl: INSFORGE_BASE_URL,
      });
    }
    return this.client;
  }

  async submitBatchImages(data: {
    batchId: string;
    firstViewIpfs: string;
    secondViewIpfs: string;
  }) {
    try {
      console.log('Database: Submitting batch images:', data);
      console.log('Database: Base URL:', INSFORGE_BASE_URL || 'NOT SET');

      const client = this.getClient();
      
      const insertData = {
        batch_id: data.batchId,
        first_view_ipfs: data.firstViewIpfs,
        second_view_ipfs: data.secondViewIpfs,
        // id is auto-generated (UUID)
        // created_at has default (CURRENT_TIMESTAMP)
        // approved has default (FALSE)
      };
      
      console.log('Database: Insert data:', insertData);
      console.log('Database: Making request to:', `${INSFORGE_BASE_URL}/rest/v1/batches`);
      
      const { data: result, error } = await client.database
        .from('batches')
        .insert(insertData)
        .select();

      if (error) {
        console.error('Database: Insert error:', error);
        console.error('Database: Error details:', JSON.stringify(error, null, 2));
        throw new Error(error.message || 'Failed to submit batch images');
      }

      console.log('Database: Submit successful:', result);
      return result;
    } catch (error: any) {
      console.error('Database: Submit failed:', error);
      console.error('Database: Error type:', error?.constructor?.name);
      console.error('Database: Error message:', error?.message);
      console.error('Database: Error stack:', error?.stack);
      
      // Provide more helpful error messages
      if (error?.message?.includes('Network request failed')) {
        throw new Error(
          `Network request failed. Please check:\n` +
          `1. EXPO_PUBLIC_INSFORGE_BASE_URL is set correctly\n` +
          `2. Your device/emulator has internet connectivity\n` +
          `3. The Insforge service is accessible\n` +
          `Current baseUrl: ${INSFORGE_BASE_URL || 'NOT SET'}`
        );
      }

      throw error;
    }
  }

  async getBatchImages(batchId: string) {
    try {
      console.log('Database: Fetching batch images for:', batchId);

      const client = this.getClient();
      
      const { data, error } = await client.database
        .from('batches')
        .select('*')
        .eq('batch_id', batchId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Database: Fetch error:', error);
        throw new Error(error.message || 'Failed to fetch batch images');
      }

      return data;
    } catch (error) {
      console.error('Database: Fetch failed:', error);
      throw error;
    }
  }

  async getAllBatches() {
    try {
      console.log('Database: Fetching all batches');

      const client = this.getClient();
      
      const { data, error } = await client.database
        .from('batches')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Database: Fetch error:', error);
        throw new Error(error.message || 'Failed to fetch batches');
      }

      console.log('Database: Fetched batches:', data?.length || 0);
      return data || [];
    } catch (error) {
      console.error('Database: Fetch failed:', error);
      throw error;
    }
  }
}

export const databaseService = new DatabaseService();

