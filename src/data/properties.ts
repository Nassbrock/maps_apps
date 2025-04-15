import { Property } from '../types/property';

export const SAMPLE_PROPERTIES: Property[] = [
  {
    id: '1',
    title: '4 Room Apartment',
    address: 'Sofia Center, ul. Tsar Samuil 21',
    description: 'Spacious 4-room apartment in the heart of Sofia',
    price: 250000,
    rooms: 4,
    coordinates: {
      latitude: 42.6977,
      longitude: 23.3219
    }
  },
  {
    id: '2',
    title: '3 Room Apartment',
    address: 'Sofia Center, ul. Tsar Simeon 21',
    description: 'Modern 3-room apartment with great views',
    price: 200000,
    rooms: 3,
    coordinates: {
      latitude: 42.7001,
      longitude: 23.3245
    }
  },
  {
    id: '3',
    title: '2 Room Apartment',
    address: 'Sofia Center, ul. Slavyanska 18-24',
    description: 'Cozy 2-room apartment in a quiet neighborhood',
    price: 150000,
    rooms: 2,
    coordinates: {
      latitude: 42.6955,
      longitude: 23.3198
    }
  }
]; 