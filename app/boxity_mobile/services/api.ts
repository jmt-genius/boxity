class ApiService {

  async scanInit(qrData: string) {
    console.log('API: Scanning QR code:', qrData);
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
      batchId: 'BOX-001-DEMO',
      productName: 'Premium Electronics Package',
      currentStage: 'Logistics' as const,
      createdAt: new Date().toISOString(),
    };
  }

  async getBatch(batchId: string) {
    console.log('API: Fetching batch:', batchId);
    
    await new Promise(resolve => setTimeout(resolve, 800));
    
    return {
      batchId,
      productName: 'Premium Electronics Package',
      currentStage: 'Logistics' as const,
      createdAt: new Date().toISOString(),
    };
  }

  async uploadMetadata(metadata: any) {
    console.log('API: Uploading metadata:', metadata);
    
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    return {
      success: true,
      id: `upload_${Date.now()}`,
      timestamp: new Date().toISOString(),
    };
  }
}

export const apiService = new ApiService();
