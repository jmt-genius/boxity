import { createClient } from '@insforge/sdk';

// InsForge configuration
const INSFORGE_BASE_URL = import.meta.env.VITE_INSFORGE_BASE_URL || 'https://fu5pg5wg.ap-southeast.insforge.app';
const INSFORGE_ANON_KEY = import.meta.env.VITE_INSFORGE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3OC0xMjM0LTU2NzgtOTBhYi1jZGVmMTIzNDU2NzgiLCJlbWFpbCI6ImFub25AaW5zZm9yZ2UuY29tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY4Nzk5OTB9.gw8M19D_s-HFW3PrDvX483SIDUMewjqBHALxKdJaW_8';

// Create InsForge client
export const insforge = createClient({
  baseUrl: INSFORGE_BASE_URL,
  anonKey: INSFORGE_ANON_KEY,
});

export const INSFORGE_CONFIG = {
  baseUrl: INSFORGE_BASE_URL,
  anonKey: INSFORGE_ANON_KEY,
};

