export interface Bar {
  id: number;
  name: string;
  address: string;
  phone?: string | null;
  website?: string | null;
  businessStatus?: string;
  rating?: number;
  isSponsored?: boolean;
  verificationStatus?: string;
  placeId?: string | null;
  location?: {
    lat: number;
    lng: number;
  } | null;
}