import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, Dimensions, Text, ScrollView, TouchableOpacity, Animated, ActivityIndicator, Linking, Image, PanResponder, Platform } from 'react-native';
import { APIProvider, Map, AdvancedMarker, InfoWindow } from '@vis.gl/react-google-maps';
import { useLocation } from '../hooks/useLocation';
import { LocationData } from '../types/property';
import locationData from '../assets/location.json';
import Constants from 'expo-constants';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useMaterialIcons } from '../hooks/useMaterialIcons';

// Define our own Place interface that matches our needs
interface LocalizedText {
  text: string;
  languageCode: string;
}

interface Photo {
  photoReference: string;
  width: number;
  height: number;
  htmlAttributions: string[];
}

interface Place {
  id: string;
  formattedAddress: string | null;
  location?: { lat: number; lng: number };
  displayName: LocalizedText;
  rating?: number;
  userRatingCount?: number;
  types?: string[];
  photos?: google.maps.places.Photo[];
  regularOpeningHours?: {
    periods: Array<{
      open: { day: number; hour: number; minute: number };
      close: { day: number; hour: number; minute: number };
    }>;
    weekdayDescriptions: string[];
  };
  websiteUri: string | null;
  type?: string;
}

interface SearchNearbyRequest {
  locationRestriction: google.maps.Circle | google.maps.CircleLiteral;
  includedTypes: string[];
  maxResultCount?: number;
  rankPreference?: 'DISTANCE' | 'RELEVANCE';
  fields: string[];
}

interface SearchNearbyResponse {
  places: Place[];
}

// Remove the custom Place interfaces and use Google's types
interface PlaceWithType extends Place {
  type?: string;
}

interface DistanceInfo {
  distance: string;
  duration: string;
  durationInTraffic?: string;
  route?: google.maps.DirectionsResult;
}

const { width, height } = Dimensions.get('window');

// Get API key from environment variables or app config
const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || 
  Constants.expoConfig?.extra?.googleMapsApiKey;

if (!GOOGLE_MAPS_API_KEY) {
  console.warn('Google Maps API key is not set. Please set EXPO_PUBLIC_GOOGLE_MAPS_API_KEY in your environment variables.');
}

const placeTypes = [
  { 
    id: 'subway_station', 
    label: 'Metro', 
    icon: 'train' as const,
    color: '#4285f4', // Blue
    markerIcon: '🚉'
  },
  { 
    id: 'restaurant', 
    label: 'Food', 
    icon: 'silverware' as const,
    color: '#DB4437', // Red
    markerIcon: '🍽️'
  },
  { 
    id: 'supermarket', 
    label: 'Groceries', 
    icon: 'cart' as const,
    color: '#F4B400', // Yellow
    markerIcon: '🛒'
  },
  { 
    id: 'school', 
    label: 'Schools', 
    icon: 'school' as const,
    color: '#0F9D58', // Green
    markerIcon: '🎓'
  },
  {
    id: 'park',
    label: 'Parks',
    icon: 'tree' as const,
    color: '#34A853', // Green
    markerIcon: '🌳'
  },
  {
    id: 'pharmacy',
    label: 'Pharmacy',
    icon: 'medical-bag' as const,
    color: '#EA4335', // Red
    markerIcon: '💊'
  },
  {
    id: 'gym',
    label: 'Fitness',
    icon: 'dumbbell' as const,
    color: '#FBBC04', // Yellow
    markerIcon: '🏋️'
  },
  {
    id: 'bank',
    label: 'Banks',
    icon: 'bank' as const,
    color: '#4285F4', // Blue
    markerIcon: '🏦'
  }
];

const MapScreen = () => {
  const { location, errorMsg } = useLocation();
  const [locations, setLocations] = useState<LocationData | null>(locationData);
  const [markers, setMarkers] = useState<{ lat: number; lng: number; title: string }[]>([]);
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [nearbyPlaces, setNearbyPlaces] = useState<Place[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [placesCache, setPlacesCache] = useState<{ [key: string]: Place[] }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<Place | null>(null);
  const [selectedProperty, setSelectedProperty] = useState<{ 
    title: string; 
    address: string; 
    location: { lat: number; lng: number }; 
  } | null>(null);
  const [distanceInfo, setDistanceInfo] = useState<DistanceInfo | null>(null);
  const [directionsRenderer, setDirectionsRenderer] = useState<google.maps.DirectionsRenderer | null>(null);
  const [travelMode, setTravelMode] = useState<'DRIVING' | 'WALKING' | 'TRANSIT'>('DRIVING');
  const [apiError, setApiError] = useState<string | null>(null);
  const pan = useRef(new Animated.ValueXY()).current;
  const [isDragging, setIsDragging] = useState(false);
  const { isLoaded: iconsLoaded, error: iconsError, MaterialCommunityIcons } = useMaterialIcons();

  useEffect(() => {
    if (!GOOGLE_MAPS_API_KEY) {
      setApiError('Google Maps API key is not configured. Please check your environment variables.');
    }
  }, []);

  useEffect(() => {
    if (iconsError) {
      console.error('Failed to load Material Icons:', iconsError);
    }
  }, [iconsError]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        setIsDragging(true);
        const currentX = Number(JSON.stringify(pan.x));
        const currentY = Number(JSON.stringify(pan.y));
        pan.setOffset({
          x: currentX,
          y: currentY
        });
      },
      onPanResponderMove: Animated.event(
        [
          null,
          { dx: pan.x, dy: pan.y }
        ],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: () => {
        setIsDragging(false);
        pan.flattenOffset();
      }
    })
  ).current;

  // Reset pan values when a new place is selected
  useEffect(() => {
    if (selectedPlace) {
      pan.setValue({ x: 0, y: 0 });
    }
  }, [selectedPlace]);

  // Effect to update places when selected types change
  useEffect(() => {
    if (selectedLocation && selectedTypes.size > 0) {
      searchNearbyPlaces(selectedLocation);
    }
  }, [selectedTypes]);

  useEffect(() => {
    const convertAddressesToCoordinates = async () => {
      if (!locations || !map) return;

      const newMarkers = await Promise.all(
        Object.entries(locations.location).map(async ([key, value]) => {
          try {
            const geocoder = new google.maps.Geocoder();
            const response = await new Promise<google.maps.GeocoderResult[]>((resolve, reject) => {
              geocoder.geocode({ address: value.address }, (results, status) => {
                if (status === 'OK' && results) {
                  resolve(results);
                } else {
                  reject(new Error(`Geocoding failed for address: ${value.address}`));
                }
              });
            });

            if (response.length > 0) {
              const { lat, lng } = response[0].geometry.location;
              return {
                lat: lat(),
                lng: lng(),
                title: key
              };
            }
          } catch (error) {
            console.error(`Error geocoding address ${value.address}:`, error);
          }
          return null;
        })
      );

      setMarkers(newMarkers.filter((marker): marker is { lat: number; lng: number; title: string } => marker !== null));
    };

    convertAddressesToCoordinates();
  }, [locations, map]);

  const searchNearbyPlaces = async (position: { lat: number; lng: number }) => {
    if (!map || selectedTypes.size === 0) return;
    setIsLoading(true);

    try {
      const newTypes = Array.from(selectedTypes).filter(type => {
        const cacheKey = `${type}-${position.lat}-${position.lng}`;
        return !placesCache[cacheKey];
      });
      
      let allResults: Place[] = [];

      // Add cached results
      Array.from(selectedTypes).forEach(type => {
        const cacheKey = `${type}-${position.lat}-${position.lng}`;
        if (placesCache[cacheKey]) {
          allResults = [...allResults, ...placesCache[cacheKey]];
        }
      });

      // Fetch new types
      if (newTypes.length > 0) {
        const { Place } = await google.maps.importLibrary("places") as google.maps.PlacesLibrary;
        
        const results = await Promise.all(
          newTypes.map(async (type) => {
            try {
              const searchRequest = {
                locationRestriction: new google.maps.Circle({
                  center: position,
                  radius: 500
                }),
                includedTypes: [type],
                maxResultCount: 20,
                fields: [
                  'id',
                  'location',
                  'displayName',
                  'formattedAddress',
                  'types',
                  'rating',
                  'userRatingCount',
                  'photos',
                  'regularOpeningHours',
                  'websiteURI'
                ]
              };

              const response = await Place.searchNearby(searchRequest);
              
              // Convert the response to our Place interface
              const convertedPlaces: Place[] = response.places.map(place => ({
                id: place.id || '',
                formattedAddress: place.formattedAddress || null,
                location: place.location ? {
                  lat: place.location.lat(),
                  lng: place.location.lng()
                } : undefined,
                displayName: typeof place.displayName === 'string' ? {
                  text: place.displayName,
                  languageCode: 'en'
                } : (place.displayName || {
                  text: '',
                  languageCode: 'en'
                }),
                rating: place.rating || undefined,
                userRatingCount: place.userRatingCount || undefined,
                types: place.types || undefined,
                photos: place.photos || undefined,
                regularOpeningHours: place.regularOpeningHours ? {
                  periods: place.regularOpeningHours.periods.map(period => ({
                    open: {
                      day: period.open?.day || 0,
                      hour: period.open?.hour || 0,
                      minute: period.open?.minute || 0
                    },
                    close: period.close ? {
                      day: period.close.day || 0,
                      hour: period.close.hour || 0,
                      minute: period.close.minute || 0
                    } : {
                      day: 0,
                      hour: 0,
                      minute: 0
                    }
                  })),
                  weekdayDescriptions: place.regularOpeningHours.weekdayDescriptions || []
                } : undefined,
                websiteUri: place.websiteURI || null,
                type
              }));

              // Cache the results
              const cacheKey = `${type}-${position.lat}-${position.lng}`;
              setPlacesCache(prev => ({
                ...prev,
                [cacheKey]: convertedPlaces
              }));

              return convertedPlaces;
            } catch (error) {
              console.error(`Error searching for ${type}:`, error);
              return [];
            }
          })
        );

        allResults = [...allResults, ...results.flat()];
      }

      setNearbyPlaces(allResults);
            
      // Adjust map bounds
      if (allResults.length > 0) {
        const bounds = new google.maps.LatLngBounds();
        allResults.forEach((place) => {
          if (place.location) {
            bounds.extend(place.location);
          }
        });
        bounds.extend(position);
        map.fitBounds(bounds);
      }
    } catch (error) {
      console.error('Error searching nearby places:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePropertyClick = (property: { title: string; address: string; location: { lat: number; lng: number } }) => {
    setSelectedProperty(property);
    setSelectedPlace(null);
    
    if (map && property.location) {
      // Center the map on the new property
      map.panTo(property.location);
      map.setZoom(15);
      
      // Update selected location for amenity searches
      setSelectedLocation(property.location);
      
      // If there are already selected amenity types, search for them at the new location
      if (selectedTypes.size > 0) {
        // Clear existing places before searching new ones
        setNearbyPlaces([]);
        // Search with current selected types at new location
        searchNearbyPlaces(property.location);
      }
    }
  };

  const handleAmenityToggle = (typeId: string) => {
    setSelectedTypes(prev => {
      const newSelectedTypes = new Set(prev);
      if (prev.has(typeId)) {
        newSelectedTypes.delete(typeId);
        // If we're removing the last type, clear all nearby places
        if (newSelectedTypes.size === 0) {
          setNearbyPlaces([]);
        }
      } else {
        newSelectedTypes.add(typeId);
      }
      return newSelectedTypes;
    });
  };

  // Initialize DirectionsRenderer when map is ready
  useEffect(() => {
    if (map) {
      const renderer = new google.maps.DirectionsRenderer({
        map,
        suppressMarkers: true,
        polylineOptions: {
          strokeColor: '#4285F4',
          strokeWeight: 5,
          strokeOpacity: 0.8,
          zIndex: 1,
          geodesic: true
        },
        preserveViewport: true
      });
      setDirectionsRenderer(renderer);
      
      return () => {
        renderer.setMap(null);
      };
    }
  }, [map]);

  const calculateDistance = async (origin: google.maps.LatLngLiteral, destination: google.maps.LatLngLiteral) => {
    try {
      // First, get the distance matrix info
      const service = new google.maps.DistanceMatrixService();
      const matrixResult = await new Promise<google.maps.DistanceMatrixResponse>((resolve, reject) => {
        service.getDistanceMatrix({
          origins: [origin],
          destinations: [destination],
          travelMode: google.maps.TravelMode[travelMode],
          ...(travelMode === 'DRIVING' && {
            drivingOptions: {
              departureTime: new Date(),
              trafficModel: google.maps.TrafficModel.BEST_GUESS
            }
          }),
          unitSystem: google.maps.UnitSystem.METRIC
        }, (response, status) => {
          if (status === 'OK' && response) {
            resolve(response);
          } else {
            reject(new Error(`Distance Matrix failed: ${status}`));
          }
        });
      });

      // Then, get the directions
      const directionsService = new google.maps.DirectionsService();
      const routeResult = await new Promise<google.maps.DirectionsResult>((resolve, reject) => {
        directionsService.route({
          origin,
          destination,
          travelMode: google.maps.TravelMode[travelMode],
        }, (result, status) => {
          if (status === 'OK' && result) {
            resolve(result);
          } else {
            reject(new Error(`Directions request failed: ${status}`));
          }
        });
      });

      const element = matrixResult.rows[0].elements[0];
      if (element.status === 'OK') {
        setDistanceInfo({
          distance: element.distance.text,
          duration: element.duration.text,
          durationInTraffic: element.duration_in_traffic?.text,
          route: routeResult
        });

        // Display the route
        if (directionsRenderer) {
          directionsRenderer.setDirections(routeResult);
        }
      }
    } catch (error) {
      console.error('Error calculating distance:', error);
      setDistanceInfo(null);
      // Clear any existing directions
      if (directionsRenderer) {
        directionsRenderer.setMap(null);
        directionsRenderer.setMap(map);
      }
    }
  };

  // Effect to update route when travel mode changes
  useEffect(() => {
    if (selectedProperty && selectedPlace?.location) {
      calculateDistance(
        { lat: selectedProperty.location.lat, lng: selectedProperty.location.lng },
        selectedPlace.location
      );
    }
  }, [travelMode]);

  const handleMarkerClick = (place: Place) => {
    setSelectedPlace(place);
    if (selectedProperty && place.location) {
      calculateDistance(
        { lat: selectedProperty.location.lat, lng: selectedProperty.location.lng },
        place.location
      );
    }
  };

  const handleTravelModeChange = (newMode: 'DRIVING' | 'WALKING' | 'TRANSIT') => {
    setTravelMode(newMode);
    // The route will be updated automatically by the useEffect above
  };

  const defaultCenter = { lat: 42.6977, lng: 23.3219 };
  const center = location ? { lat: location.latitude, lng: location.longitude } : defaultCenter;

  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>
          Google Maps API key is not configured. Please check your environment variables.
        </Text>
      </View>
    );
  }

  if (!iconsLoaded) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text style={styles.loadingText}>Loading icons...</Text>
      </View>
    );
  }

  if (errorMsg) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{errorMsg}</Text>
      </View>
    );
  }

  if (apiError) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>{apiError}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <APIProvider apiKey={GOOGLE_MAPS_API_KEY} libraries={['places']}>
        {selectedProperty && (
          <View style={styles.propertyCard}>
            <View style={styles.propertyImageContainer}>
              <Image 
                source={require('../assets/placeholder-apartment.jpg')} 
                style={styles.propertyImage}
                resizeMode="cover"
              />
            </View>
            <View style={styles.propertyInfo}>
              <Text style={styles.propertyTitle}>{selectedProperty.title}</Text>
              <View style={styles.propertyDetails}>
                <MaterialCommunityIcons name="map-marker" size={16} color="#5f6368" />
                <Text style={styles.propertyAddress}>{selectedProperty.address}</Text>
              </View>
              <Text style={styles.propertyDescription}>
                Sunny apartment - 400sqft
              </Text>
              <View style={styles.propertyAmenities}>
                <TouchableOpacity 
                  style={styles.propertyAmenityButton}
                  onPress={() => {
                    if (selectedProperty.location) {
                      setSelectedLocation(selectedProperty.location);
                      setSelectedTypes(new Set(['subway_station']));
                    }
                  }}
                >
                  <MaterialCommunityIcons name="train" size={20} color="#4285f4" />
                  <Text style={styles.amenityLabel}>Metro</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.propertyAmenityButton}
                  onPress={() => {
                    if (selectedProperty.location) {
                      setSelectedLocation(selectedProperty.location);
                      setSelectedTypes(new Set(['restaurant']));
                    }
                  }}
                >
                  <MaterialCommunityIcons name="silverware" size={20} color="#DB4437" />
                  <Text style={styles.amenityLabel}>Food</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.propertyAmenityButton}
                  onPress={() => {
                    if (selectedProperty.location) {
                      setSelectedLocation(selectedProperty.location);
                      setSelectedTypes(new Set(['supermarket']));
                    }
                  }}
                >
                  <MaterialCommunityIcons name="cart" size={20} color="#F4B400" />
                  <Text style={styles.amenityLabel}>Groceries</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.propertyAmenityButton}
                  onPress={() => {
                    if (selectedProperty.location) {
                      setSelectedLocation(selectedProperty.location);
                      setSelectedTypes(new Set(['school']));
                    }
                  }}
                >
                  <MaterialCommunityIcons name="school" size={20} color="#0F9D58" />
                  <Text style={styles.amenityLabel}>Schools</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}
        <Map
          style={styles.map}
          defaultCenter={defaultCenter}
          defaultZoom={12}
          gestureHandling={'greedy'}
          disableDefaultUI={true}
          onIdle={(event) => setMap(event.map)}
          mapId={Constants.expoConfig?.extra?.googleMapsMapId}
        >
          {/* User location marker */}
          {location && (
            <AdvancedMarker
              position={{ lat: location.latitude, lng: location.longitude }}
              title="Your Location"
            />
          )}

          {/* Property location markers */}
          {markers.map((marker, index) => (
            <AdvancedMarker
              key={index}
              position={{ lat: marker.lat, lng: marker.lng }}
              title={marker.title}
              onClick={() => handlePropertyClick({
                title: marker.title,
                address: locations?.location[marker.title]?.address || '',
                location: { lat: marker.lat, lng: marker.lng }
              })}
            >
              <View style={[
                styles.propertyMarkerContainer,
                selectedProperty?.title === marker.title && styles.selectedPropertyMarkerContainer
              ]}>
                <View style={[
                  styles.propertyMarker,
                  selectedProperty?.title === marker.title && styles.selectedPropertyMarker
                ]}>
                  <MaterialCommunityIcons 
                    name="home" 
                    size={selectedProperty?.title === marker.title ? 32 : 24} 
                    color={selectedProperty?.title === marker.title ? '#9C27B0' : '#757575'} 
                  />
                </View>
                {selectedProperty?.title === marker.title && (
                  <View style={styles.pinLine}>
                    <View style={styles.pinDot} />
                  </View>
                )}
              </View>
            </AdvancedMarker>
          ))}

          {/* Nearby place markers */}
          {nearbyPlaces.map((place, index) => {
            if (!place.location) return null;
            const placeType = placeTypes.find(t => t.id === place.type);
            return (
              <AdvancedMarker
                key={`${place.id}-${index}`}
                position={place.location}
                onClick={() => handleMarkerClick(place)}
              >
                <View style={[
                  styles.placeMarker,
                  { backgroundColor: placeType?.color || '#4285f4' }
                ]}>
                  <Text style={styles.markerText}>{placeType?.markerIcon || '📍'}</Text>
                </View>
              </AdvancedMarker>
            );
          })}

          {/* Replace the InfoWindow with a custom draggable card */}
          {selectedPlace && selectedPlace.location && (
            <View 
              style={[
                styles.infoWindowContainer, 
                { 
                  pointerEvents: isDragging ? 'box-none' : 'none'
                }
              ]}
            >
              <Animated.View
                style={[
                  styles.draggableInfoWindow,
                  {
                    transform: [
                      { translateX: pan.x },
                      { translateY: pan.y }
                    ],
                    pointerEvents: 'box-none'
                  }
                ]}
              >
                <View 
                  style={[
                    styles.dragHeader,
                    Platform.OS === 'web' ? {
                      // @ts-ignore -- web-specific styles
                      cursor: 'move',
                      userSelect: 'none',
                      WebkitUserSelect: 'none',
                      MozUserSelect: 'none',
                      msUserSelect: 'none',
                      pointerEvents: 'auto'
                    } : {}
                  ]}
                  {...panResponder.panHandlers}
                >
                  <View style={styles.dragHandle} />
                </View>
                <View 
                  style={[
                    styles.infoWindow,
                    {
                      pointerEvents: 'auto'
                    },
                    isDragging && Platform.OS === 'web' ? {
                      // @ts-ignore -- web-specific styles
                      userSelect: 'none',
                      WebkitUserSelect: 'none',
                      MozUserSelect: 'none',
                      msUserSelect: 'none',
                    } : {}
                  ]}
                >
                  <Text style={styles.infoTitle}>{selectedPlace.displayName?.text}</Text>
                  <Text style={styles.infoAddress}>{selectedPlace.formattedAddress}</Text>
                  {selectedPlace.rating && (
                    <Text style={styles.infoRating}>Rating: {selectedPlace.rating} ⭐</Text>
                  )}
                  {selectedPlace.regularOpeningHours && (
                    <Text style={styles.infoStatus}>
                      {selectedPlace.regularOpeningHours.periods.length > 0 ? '🟢 Open Now' : '🔴 Closed'}
                    </Text>
                  )}
                  {distanceInfo && (
                    <View style={styles.distanceInfo}>
                      <Text style={styles.distanceText}>
                        {travelMode === 'DRIVING' ? '🚗' : 
                         travelMode === 'WALKING' ? '🚶' : 
                         travelMode === 'TRANSIT' ? '🚌' : '🚗'} 
                        {distanceInfo.distance}
                      </Text>
                      <Text style={styles.durationText}>⏱️ {distanceInfo.durationInTraffic || distanceInfo.duration}</Text>
                    </View>
                  )}
                  <View style={styles.travelModeButtons}>
                    <TouchableOpacity 
                      style={[styles.travelModeButton, travelMode === 'DRIVING' && styles.travelModeButtonActive]}
                      onPress={() => handleTravelModeChange('DRIVING')}
                    >
                      <MaterialCommunityIcons name="car" size={20} color={travelMode === 'DRIVING' ? '#fff' : '#666'} />
                      <Text style={[styles.travelModeText, travelMode === 'DRIVING' && styles.travelModeTextActive]}>Drive</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.travelModeButton, travelMode === 'WALKING' && styles.travelModeButtonActive]}
                      onPress={() => handleTravelModeChange('WALKING')}
                    >
                      <MaterialCommunityIcons name="walk" size={20} color={travelMode === 'WALKING' ? '#fff' : '#666'} />
                      <Text style={[styles.travelModeText, travelMode === 'WALKING' && styles.travelModeTextActive]}>Walk</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={[styles.travelModeButton, travelMode === 'TRANSIT' && styles.travelModeButtonActive]}
                      onPress={() => handleTravelModeChange('TRANSIT')}
                    >
                      <MaterialCommunityIcons name="bus" size={20} color={travelMode === 'TRANSIT' ? '#fff' : '#666'} />
                      <Text style={[styles.travelModeText, travelMode === 'TRANSIT' && styles.travelModeTextActive]}>Transit</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.infoButtons}>
                    {selectedPlace.websiteUri && (
                      <TouchableOpacity 
                        onPress={() => Linking.openURL(selectedPlace.websiteUri || '')}
                        style={[styles.infoButton, styles.websiteButton]}
                      >
                        <Text style={styles.buttonText}>Visit Website</Text>
                      </TouchableOpacity>
                    )}
                    {distanceInfo && (
                      <TouchableOpacity 
                        onPress={() => {
                          if (selectedProperty && selectedPlace.location && directionsRenderer) {
                            // Center the map to show the entire route
                            const bounds = new google.maps.LatLngBounds();
                            bounds.extend(selectedProperty.location);
                            bounds.extend(selectedPlace.location);
                            map?.fitBounds(bounds, { top: 100, right: 100, bottom: 100, left: 100 });
                          }
                        }}
                        style={[styles.infoButton, styles.directionsButton]}
                      >
                        <Text style={styles.buttonText}>Show Route</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </Animated.View>
            </View>
          )}
        </Map>
      </APIProvider>

      {/* Amenities Panel */}
      <View style={styles.amenitiesPanel}>
        {placeTypes.map((type) => (
          <TouchableOpacity
            key={type.id}
            style={[
              styles.amenityButton,
              selectedTypes.has(type.id) && styles.amenityButtonActive
            ]}
            onPress={() => handleAmenityToggle(type.id)}
          >
            <MaterialCommunityIcons
              name={type.icon}
              size={24}
              color={selectedTypes.has(type.id) ? type.color : '#666'}
            />
            <Text style={[
              styles.amenityText,
              selectedTypes.has(type.id) && { color: type.color }
            ]}>
              {type.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  amenitiesPanel: {
    position: 'absolute',
    bottom: 24,
    left: '50%',
    transform: [{ translateX: -width * 0.4 }],
    width: width * 0.8,
    backgroundColor: 'white',
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  amenityButton: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  amenityButtonActive: {
    opacity: 1,
  },
  amenityText: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  amenityTextActive: {
    color: '#4285f4',
  },
  propertyMarkerContainer: {
    alignItems: 'center',
  },
  selectedPropertyMarkerContainer: {
    transform: [{ translateY: -20 }], // Lift the marker up when selected
  },
  propertyMarker: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
  },
  selectedPropertyMarker: {
    width: 56,
    height: 56,
    borderWidth: 2,
    borderColor: '#9C27B0',
  },
  pinLine: {
    width: 2,
    height: 20,
    backgroundColor: '#9C27B0',
    marginTop: -1,
  },
  pinDot: {
    position: 'absolute',
    bottom: -4,
    left: -3,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#9C27B0',
  },
  placeMarker: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
    transform: [{ translateX: -20 }, { translateY: -20 }],
  },
  markerText: {
    fontSize: 20,
    textAlign: 'center',
  },
  loadingContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -20 }, { translateY: -20 }],
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 10,
    padding: 10,
  },
  infoWindowContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dragHeader: {
    padding: 8,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    backgroundColor: 'white',
    alignItems: 'center'
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
  },
  draggableInfoWindow: {
    position: 'absolute',
    top: '30%',
    left: '50%',
    transform: [{ translateX: -150 }], // Half of the card width
    width: 300,
    backgroundColor: 'white',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    overflow: 'hidden',
  },
  infoWindow: {
    padding: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#202124',
  },
  infoAddress: {
    fontSize: 14,
    color: '#5f6368',
    marginBottom: 4,
  },
  infoRating: {
    fontSize: 14,
    color: '#fbbc04',
    marginBottom: 4,
  },
  infoStatus: {
    fontSize: 14,
    color: '#5f6368',
    marginBottom: 8,
  },
  infoPhone: {
    fontSize: 14,
    color: '#5f6368',
    marginBottom: 4,
  },
  websiteButton: {
    backgroundColor: '#1a73e8',
    padding: 8,
    borderRadius: 4,
    alignItems: 'center',
    marginTop: 4,
  },
  websiteButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  propertyCard: {
    position: 'absolute',
    top: 20,
    left: 20,
    backgroundColor: 'white',
    borderRadius: 12,
    width: 320,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    zIndex: 1000,
  },
  propertyImageContainer: {
    width: '100%',
    height: 200,
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    overflow: 'hidden',
  },
  propertyImage: {
    width: '100%',
    height: '100%',
  },
  propertyInfo: {
    padding: 16,
  },
  propertyTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#202124',
    marginBottom: 8,
  },
  propertyDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  propertyAddress: {
    fontSize: 14,
    color: '#5f6368',
    marginLeft: 4,
    flex: 1,
  },
  propertyDescription: {
    fontSize: 16,
    color: '#202124',
    marginBottom: 16,
  },
  propertyAmenities: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e8eaed',
  },
  propertyAmenityButton: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  amenityLabel: {
    fontSize: 12,
    color: '#5f6368',
    marginTop: 4,
  },
  distanceInfo: {
    marginTop: 8,
    marginBottom: 8,
    padding: 8,
    backgroundColor: '#f8f9fa',
    borderRadius: 4,
  },
  distanceText: {
    fontSize: 14,
    color: '#202124',
    marginBottom: 4,
  },
  durationText: {
    fontSize: 14,
    color: '#5f6368',
  },
  infoButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    gap: 8,
  },
  infoButton: {
    flex: 1,
    padding: 8,
    borderRadius: 4,
    alignItems: 'center',
  },
  directionsButton: {
    backgroundColor: '#34A853',
  },
  buttonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '500',
  },
  travelModeButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 8,
    gap: 8,
  },
  travelModeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    borderRadius: 4,
    backgroundColor: '#f8f9fa',
    gap: 4,
  },
  travelModeButtonActive: {
    backgroundColor: '#4285F4',
  },
  travelModeText: {
    fontSize: 12,
    color: '#666',
  },
  travelModeTextActive: {
    color: '#fff',
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
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
});

export default MapScreen; 