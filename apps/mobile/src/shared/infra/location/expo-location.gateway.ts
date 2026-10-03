import {
  LocationUnavailableError,
  type LocationCoordinates,
  type LocationGateway,
} from '@src/core/ports/location-gateway';
import * as Location from 'expo-location';

function getFreshCoordinates(signal: AbortSignal): Promise<LocationCoordinates> {
  return new Promise((resolve, reject) => {
    let finished = false;
    let subscription: Location.LocationSubscription | undefined;
    const finish = (coordinates?: LocationCoordinates, error?: Error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
      subscription?.remove();
      if (coordinates) resolve(coordinates);
      else reject(error ?? new LocationUnavailableError('Location unavailable'));
    };
    const onAbort = () => finish(undefined, new Error('Location cancelled'));
    const timer = setTimeout(() => finish(undefined, new Error('Location timeout')), 10_000);
    signal.addEventListener('abort', onAbort, { once: true });
    if (signal.aborted) {
      onAbort();
      return;
    }
    void Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        distanceInterval: 0,
        mayShowUserSettingsDialog: false,
      },
      ({ coords }) => finish({ latitude: coords.latitude, longitude: coords.longitude }),
      () => finish(undefined, new Error('Location unavailable')),
    ).then(
      (watch) => {
        subscription = watch;
        if (finished) watch.remove();
      },
      () => finish(undefined, new Error('Location unavailable')),
    );
  });
}

function waitForNativeResult<T>(
  operation: Promise<T>,
  signal: AbortSignal,
  timeout: number,
  fallback: T,
): Promise<T> {
  return new Promise((resolve) => {
    let finished = false;
    const finish = (value: T) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
      resolve(value);
    };
    const onAbort = () => finish(fallback);
    const timer = setTimeout(onAbort, timeout);
    signal.addEventListener('abort', onAbort, { once: true });
    void operation.then(finish, onAbort);
    if (signal.aborted) onAbort();
  });
}

async function getPlace(coordinates: LocationCoordinates, signal: AbortSignal) {
  if (signal.aborted) return { countryCode: null, name: null };
  const places = await waitForNativeResult(
    Location.reverseGeocodeAsync(coordinates),
    signal,
    5_000,
    [],
  );
  const place = places[0];
  return {
    countryCode: place?.isoCountryCode ?? null,
    name: place ? [place.city, place.district].filter(Boolean).join(' ') || null : null,
  };
}

export const expoLocationGateway: LocationGateway = {
  getPermission: () => Location.getForegroundPermissionsAsync(),
  requestPermission: () => Location.requestForegroundPermissionsAsync(),
  getCoordinates: async (signal) => {
    // 위치 watch에만 자원을 할당하고, 취소되면 늦게 생성된 구독까지 제거한다.
    const cached = await waitForNativeResult(
      Location.getLastKnownPositionAsync({
        maxAge: 5 * 60_000,
        requiredAccuracy: 1_000,
      }),
      signal,
      2_000,
      null,
    );
    if (signal.aborted) throw new Error('Location cancelled');
    return cached
      ? { latitude: cached.coords.latitude, longitude: cached.coords.longitude }
      : getFreshCoordinates(signal);
  },
  getPlace,
};
