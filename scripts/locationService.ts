import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';

const LOCATION_CACHE_KEY = '@meu-cesto:user-location';
const LOCATION_CACHE_TTL_MS = 1000 * 60 * 60 * 6;

export type UserLocation = {
  latitude: number;
  longitude: number;
  city?: string;
  state?: string;
  country?: string;
  cachedAt: number;
};

// Busca localização do cache local
export const getCachedLocation = async (): Promise<UserLocation | null> => {
  try {
    const raw = await AsyncStorage.getItem(LOCATION_CACHE_KEY);
    if (!raw) return null;

    const parsed: UserLocation = JSON.parse(raw);
    const age = Date.now() - parsed.cachedAt;
    if (age > LOCATION_CACHE_TTL_MS) return null;

    return parsed;
  } catch {
    return null;
  }
};

// Salva localização no cache local
const cacheLocation = async (location: UserLocation) => {
  try {
    await AsyncStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify(location));
  } catch {
    // silencia erros de cache
  }
};

// Limpa cache de localização (para forçar nova permissão)
export const clearLocationCache = async () => {
  try {
    await AsyncStorage.removeItem(LOCATION_CACHE_KEY);
  } catch { }
};

// Busca nome da cidade via reverse geocoding
const reverseGeocode = async (
  latitude: number,
  longitude: number
): Promise<{ city?: string; state?: string; country?: string }> => {
  try {
    const results = await Location.reverseGeocodeAsync({ latitude, longitude });
    if (results.length > 0) {
      const first = results[0];
      return {
        city: first.city || first.subregion || undefined,
        state: first.region || undefined,
        country: first.country || undefined,
      };
    }
  } catch {
    // silencia erros de geocoding
  }
  return {};
};

// Solicita permissão e pega localização atual
export const requestUserLocation = async (): Promise<{
  location: UserLocation | null;
  status: 'granted' | 'denied' | 'unavailable';
}> => {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();

    if (status !== 'granted') {
      return { location: null, status: 'denied' };
    }

    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    const { latitude, longitude } = position.coords;
    const geoInfo = await reverseGeocode(latitude, longitude);

    const location: UserLocation = {
      latitude,
      longitude,
      ...geoInfo,
      cachedAt: Date.now(),
    };

    await cacheLocation(location);
    return { location, status: 'granted' };
  } catch {
    return { location: null, status: 'unavailable' };
  }
};

// Verifica se a permissão já foi concedida sem pedir novamente
export const checkLocationPermission = async (): Promise<'granted' | 'denied' | 'undetermined'> => {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    return status as 'granted' | 'denied' | 'undetermined';
  } catch {
    return 'undetermined';
  }
};

// Formata localização para um texto legível
export const formatLocationLabel = (location: UserLocation | null): string => {
  if (!location) return 'Localização desconhecida';
  const parts = [location.city, location.state].filter(Boolean);
  return parts.join(', ') || `${location.latitude.toFixed(2)}, ${location.longitude.toFixed(2)}`;
};
