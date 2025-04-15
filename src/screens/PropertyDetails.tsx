import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { APIProvider, Map, Marker } from '@vis.gl/react-google-maps';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Property } from '../types/property';

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

if (!GOOGLE_MAPS_API_KEY) {
  throw new Error(
    'Google Maps API key is not set. Please set EXPO_PUBLIC_GOOGLE_MAPS_API_KEY in your environment variables.'
  );
}

interface PropertyDetailsProps {
  route: {
    params: {
      property: Property;
    };
  };
}

const PropertyDetails = ({ route }: PropertyDetailsProps) => {
  const { property } = route.params;

  return (
    <ScrollView style={styles.container}>
      {!GOOGLE_MAPS_API_KEY ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>
            Google Maps API key is not configured. Please set EXPO_PUBLIC_GOOGLE_MAPS_API_KEY in your environment variables.
          </Text>
        </View>
      ) : (
        <View style={styles.content}>
          <Text style={styles.title}>{property.title}</Text>
          <Text style={styles.address}>{property.address}</Text>
          {property.price && (
            <Text style={styles.price}>${property.price.toLocaleString()}</Text>
          )}
          {property.description && (
            <Text style={styles.description}>{property.description}</Text>
          )}
          
          <View style={styles.mapContainer}>
            <APIProvider apiKey={GOOGLE_MAPS_API_KEY}>
              <Map
                style={styles.map}
                defaultCenter={{ lat: property.coordinates.latitude, lng: property.coordinates.longitude }}
                defaultZoom={14}
                mapId={process.env.EXPO_PUBLIC_GOOGLE_MAPS_MAP_ID}
              >
                <Marker
                  position={{ lat: property.coordinates.latitude, lng: property.coordinates.longitude }}
                  title={property.title}
                />
              </Map>
            </APIProvider>
          </View>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  address: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  price: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    color: '#666',
    marginBottom: 16,
  },
  mapContainer: {
    height: 300,
    marginBottom: 16,
    borderRadius: 8,
    overflow: 'hidden',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  errorContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -20 }, { translateY: -20 }],
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 10,
    padding: 10,
  },
  errorText: {
    color: 'red',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default PropertyDetails; 