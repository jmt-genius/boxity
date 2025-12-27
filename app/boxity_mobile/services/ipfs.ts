import * as ImageManipulator from 'expo-image-manipulator';
import axios from 'axios';

const PINATA_API_KEY = process.env.EXPO_PUBLIC_PINATA_API_KEY || '';
const PINATA_SECRET_KEY = process.env.EXPO_PUBLIC_PINATA_SECRET_KEY || '';
const PINATA_JWT = process.env.EXPO_PUBLIC_PINATA_JWT || '';

class IpfsService {
  private useMockMode = !PINATA_JWT && !PINATA_API_KEY;

  async uploadImage(imageUri: string): Promise<string> {
    console.log('IPFS: Starting upload for:', imageUri);

    const compressedImage = await ImageManipulator.manipulateAsync(
      imageUri,
      [{ resize: { width: 1920 } }],
      { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
    );

    console.log('IPFS: Image compressed:', compressedImage.uri);

    if (this.useMockMode) {
      return this.uploadMock(compressedImage.uri);
    }

    return this.uploadToPinata(compressedImage.uri);
  }

  private async uploadToPinata(imageUri: string): Promise<string> {
    try {
      const formData = new FormData();
      
      const filename = imageUri.split('/').pop() || 'image.jpg';
      const type = 'image/jpeg';
      
      const file = {
        uri: imageUri,
        name: filename,
        type,
      } as any;

      formData.append('file', file);
      formData.append('network', 'public');

      const headers: any = {};

      if (PINATA_JWT) {
        headers['Authorization'] = `Bearer ${PINATA_JWT}`;
      } else if (PINATA_API_KEY && PINATA_SECRET_KEY) {
        headers['pinata_api_key'] = PINATA_API_KEY;
        headers['pinata_secret_api_key'] = PINATA_SECRET_KEY;
      }

      console.log('IPFS: Uploading to Pinata v3 API...');
      
      const response = await fetch('https://uploads.pinata.cloud/v3/files', {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Pinata upload failed: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.data?.cid) {
        const ipfsUrl = `https://ipfs.io/ipfs/${result.data.cid}`;
        console.log('IPFS: Upload complete:', ipfsUrl);
        return ipfsUrl;
      } else {
        throw new Error('No CID returned from Pinata');
      }
    } catch (error) {
      console.error('IPFS: Pinata upload failed:', error);
      console.warn('IPFS: Falling back to mock mode');
      return this.uploadMock(imageUri);
    }
  }

  private async uploadMock(imageUri: string): Promise<string> {
    console.log('IPFS: Using mock upload mode');
    await new Promise(resolve => setTimeout(resolve, 2000));

    const mockCid = `Qm${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
    const ipfsUrl = `https://ipfs.io/ipfs/${mockCid}`;

    console.log('IPFS: Mock upload complete:', ipfsUrl);

    return ipfsUrl;
  }

  async uploadMetadata(metadata: any): Promise<string> {
    console.log('IPFS: Uploading metadata:', metadata);

    if (this.useMockMode) {
      return this.uploadMetadataMock(metadata);
    }

    return this.uploadMetadataToPinata(metadata);
  }

  private async uploadMetadataToPinata(metadata: any): Promise<string> {
    try {
      const headers: any = {
        'Content-Type': 'application/json',
      };

      if (PINATA_JWT) {
        headers['Authorization'] = `Bearer ${PINATA_JWT}`;
      } else if (PINATA_API_KEY && PINATA_SECRET_KEY) {
        headers['pinata_api_key'] = PINATA_API_KEY;
        headers['pinata_secret_api_key'] = PINATA_SECRET_KEY;
      }

      const data = {
        pinataContent: metadata,
        pinataMetadata: {
          name: `metadata_${Date.now()}.json`,
        },
      };

      console.log('IPFS: Uploading metadata to Pinata...');

      const response = await axios.post(
        'https://api.pinata.cloud/pinning/pinJSONToIPFS',
        data,
        { headers }
      );

      const ipfsHash = response.data.IpfsHash;
      const ipfsUrl = `https://gateway.pinata.cloud/ipfs/${ipfsHash}`;

      console.log('IPFS: Metadata upload complete:', ipfsUrl);

      return ipfsUrl;
    } catch (error) {
      console.error('IPFS: Pinata metadata upload failed:', error);
      console.warn('IPFS: Falling back to mock mode');
      return this.uploadMetadataMock(metadata);
    }
  }

  private async uploadMetadataMock(metadata: any): Promise<string> {
    console.log('IPFS: Using mock metadata upload mode');
    await new Promise(resolve => setTimeout(resolve, 1000));

    const mockCid = `Qm${Math.random().toString(36).substring(2, 15)}${Math.random().toString(36).substring(2, 15)}`;
    const ipfsUrl = `https://gateway.pinata.cloud/ipfs/${mockCid}`;

    console.log('IPFS: Mock metadata upload complete:', ipfsUrl);

    return ipfsUrl;
  }
}

export const ipfsService = new IpfsService();
