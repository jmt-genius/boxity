import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

class DatabaseService {
  private client: ReturnType<typeof createClient> | null = null;

  private getClient() {
    if (!this.client) {
      if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        const errorMsg = 'Supabase environment variables are missing. Please check EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env';
        console.error('Database:', errorMsg);
        throw new Error(errorMsg);
      }

      console.log('Database: Initializing Supabase client with url:', SUPABASE_URL);

      this.client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
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

      const supabase = this.getClient();

      const insertData = {
        batch_id: data.batchId,
        first_view_ipfs: data.firstViewIpfs,
        second_view_ipfs: data.secondViewIpfs,
        // id is auto-generated (UUID)
        // created_at has default (CURRENT_TIMESTAMP)
        // approved has default (FALSE)
      };

      console.log('Database: Insert data:', insertData);

      const { data: result, error } = await supabase
        .from('batches')
        .insert(insertData as any)
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

      if (error?.message?.includes('Network request failed')) {
        throw new Error(
          `Network request failed. Please check your internet connectivity.`
        );
      }

      throw error;
    }
  }

  async getBatchImages(batchId: string) {
    try {
      console.log('Database: Fetching batch images for:', batchId);

      const supabase = this.getClient();

      const { data, error } = await supabase
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

      const supabase = this.getClient();

      const { data, error } = await supabase
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


