import { useEffect, useState } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Font from 'expo-font';

export function useMaterialIcons() {
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadFont = async () => {
      try {
        await Font.loadAsync({
          'MaterialCommunityIcons': require('@expo/vector-icons/build/vendor/react-native-vector-icons/Fonts/MaterialCommunityIcons.ttf'),
        });
        if (mounted) {
          setIsLoaded(true);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err : new Error('Failed to load MaterialCommunityIcons'));
          setIsLoaded(true); // Still set loaded to true to prevent infinite loading
        }
      }
    };

    loadFont();

    return () => {
      mounted = false;
    };
  }, []);

  return { isLoaded, error, MaterialCommunityIcons };
} 