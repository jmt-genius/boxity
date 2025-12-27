export type UserRole = 'MANUFACTURER' | 'DISTRIBUTOR' | 'WAREHOUSE' | 'DELIVERY_PERSON';

export interface User {
  id: string;
  email: string;
  role: UserRole;
  name: string;
}

