import {
  LocationUnavailableError,
  type LocationCoordinates,
  type LocationGateway,
  type LocationPermission,
} from '@src/core/ports/location-gateway';
import { MINUTE_MS, SECOND_MS } from '@src/shared/constants/time-units';
import * as Location from 'expo-location';

import { IS_IOS_APP_ON_MAC } from '../device/device-info';
import { toPlaceName } from './place-name';

const LAST_KNOWN_LOCATION_MAX_AGE_MS = 30 * MINUTE_MS;
const LAST_KNOWN_LOCATION_ACCURACY_METERS = 5_000;
const FRESH_LOCATION_TIMEOUT_MS = 10 * SECOND_MS;
const LAST_KNOWN_LOCATION_READ_TIMEOUT_MS = 2 * SECOND_MS;
const REVERSE_GEOCODE_TIMEOUT_MS = 5 * SECOND_MS;

function getFreshCoordinates(signal: AbortSignal): Promise<LocationCoordinates> {
  return new Promise((resolve, reject) => {
    let finished = false;
    let subscription: Location.LocationSubscription | undefined;
    const finish = (coordinates?: LocationCoordinates, error?: Error) => {
      if (finished) {
        return;
      }
      finished = true;
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
      subscription?.remove();
      if (coordinates) {
        resolve(coordinates);
      } else {
        reject(error ?? new LocationUnavailableError('Location unavailable'));
      }
    };
    const onAbort = () => finish(undefined, new Error('Location cancelled'));
    const timer = setTimeout(
      () => finish(undefined, new LocationUnavailableError('Location timeout')),
      FRESH_LOCATION_TIMEOUT_MS,
    );
    signal.addEventListener('abort', onAbort, { once: true });
    if (signal.aborted) {
      onAbort();
      return;
    }
    Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        distanceInterval: 0,
        mayShowUserSettingsDialog: false,
      },
      ({ coords }) => finish({ latitude: coords.latitude, longitude: coords.longitude }),
      () => finish(undefined, new LocationUnavailableError('Location unavailable')),
    ).then(
      (watch) => {
        subscription = watch;
        if (finished) {
          watch.remove();
        }
      },
      () => finish(undefined, new LocationUnavailableError('Location unavailable')),
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
      if (finished) {
        return;
      }
      finished = true;
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
      resolve(value);
    };
    const onAbort = () => finish(fallback);
    const timer = setTimeout(onAbort, timeout);
    signal.addEventListener('abort', onAbort, { once: true });
    operation.then(finish, onAbort);
    if (signal.aborted) {
      onAbort();
    }
  });
}

async function getPlace(coordinates: LocationCoordinates, signal: AbortSignal) {
  if (signal.aborted) {
    return { countryCode: null, name: null };
  }
  const places = await waitForNativeResult(
    Location.reverseGeocodeAsync(coordinates),
    signal,
    REVERSE_GEOCODE_TIMEOUT_MS,
    [],
  );
  const place = places[0];
  return {
    countryCode: place?.isoCountryCode ?? null,
    name: place ? toPlaceName(place) : null,
  };
}

function toLocationPermission({
  granted,
  canAskAgain,
}: Location.LocationPermissionResponse): LocationPermission {
  return { isGranted: granted, canAskAgain };
}

export const expoLocationGateway: LocationGateway = {
  getPermission: async () => toLocationPermission(await Location.getForegroundPermissionsAsync()),
  requestPermission: async () =>
    toLocationPermission(await Location.requestForegroundPermissionsAsync()),
  // Mac(Designed for iPad)은 앱을 다시 켠 직후 OS에 허용이 남아 있어도 상태 읽기가 응답하지 않는 경우가 있다.
  // 요청 API는 이미 허용한 앱에는 창 없이 허용을 돌려주므로 Mac에서만 요청으로 다시 확인한다.
  recheckPermission: async () =>
    toLocationPermission(
      IS_IOS_APP_ON_MAC
        ? await Location.requestForegroundPermissionsAsync()
        : await Location.getForegroundPermissionsAsync(),
    ),
  getCoordinates: async (signal) => {
    // 날씨는 약 5km 칸 단위라 최근 위치면 충분하다. 움직이지 않는 기기는 새 위치 업데이트가 오지 않아
    // watch만 기다리면 시간 초과가 나므로, 최근 위치가 없을 때만 새로 받는다.
    const cached = await waitForNativeResult(
      Location.getLastKnownPositionAsync({
        maxAge: LAST_KNOWN_LOCATION_MAX_AGE_MS,
        requiredAccuracy: LAST_KNOWN_LOCATION_ACCURACY_METERS,
      }),
      signal,
      LAST_KNOWN_LOCATION_READ_TIMEOUT_MS,
      null,
    );
    if (signal.aborted) {
      throw new Error('Location cancelled');
    }
    return cached
      ? { latitude: cached.coords.latitude, longitude: cached.coords.longitude }
      : getFreshCoordinates(signal);
  },
  getPlace,
};
