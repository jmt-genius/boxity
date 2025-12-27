export type UserRole = 'MANUFACTURER' | 'DISTRIBUTOR' | 'WAREHOUSE' | 'DELIVERY_PERSON';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  name: string;
}

export interface BatchInfo {
  batchId: string;
  productName: string;
  currentStage: UserRole;
  createdAt: string;
}

export interface CapturedImage {
  uri: string;
  viewType: 'first_view' | 'second_view';
  timestamp: string;
}

export interface UploadMetadata {
  batchId: string;
  viewType: 'first_view' | 'second_view';
  ipfsUrl: string;
  timestamp: string;
  actorRole: UserRole;
  deviceId: string;
}

export interface UploadRecord extends UploadMetadata {
  id: string;
  status: 'uploaded' | 'pending' | 'synced';
  productName?: string;
}
