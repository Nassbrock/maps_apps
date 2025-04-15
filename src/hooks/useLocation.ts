import { useState, useEffect } from 'react';
import * as Location from 'expo-location';

interface Location {
  latitude: number;
  longitude: number;
}

export function useLocation() {
  const [location, setLocation] = useState<Location | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Permission to access location was denied');
        return;
      }

      try {
        const location = await Location.getCurrentPositionAsync({});
        setLocation({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });
      } catch (error) {
        setErrorMsg('Error getting location');
      }
    })();
  }, []);

  return { location, errorMsg };
} 