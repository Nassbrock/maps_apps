export interface Property {
  id: string;
  title: string;
  address: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
  rooms?: number;
  price?: number;
  description?: string;
}

export interface NearbyPlace {
  id: string;
  name: string;
  type: 'restaurant' | 'school' | 'subway_station' | 'supermarket';
  coordinates: {
    latitude: number;
    longitude: number;
  };
  distance?: number;
}

export interface LocationData {
  location: {
    [key: string]: {
      address: string;
    };
  };
} 