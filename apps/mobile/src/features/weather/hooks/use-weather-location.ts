import { useDeviceLocation, useLogger } from '@src/bootstrap/providers/di-context';
import { useTrack } from '@src/shared/analytics';
import { getErrorMessage } from '@src/shared/errors';
import { useOpenAppSettings } from '@src/shared/hooks/use-open-app-settings';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { match, P } from 'ts-pattern';

import { WEATHER_LOG_EVENT } from '../constants/weather-log-events';
import {
  type WeatherLocationStatus,
  WeatherLocationPolicy,
} from '../domains/weather-location.model';
import type { PlaceName } from '../domains/weather-location.model';
import { refetchWeatherLocation } from '../queries/weather-cache';
import { useGetWeatherLocationQueryOptions } from '../queries/weather.queries';
import { toPermissionResult } from '../utils/weather-analytics';

export type WeatherLocation =
  | { status: 'checking' }
  | { status: 'needsPermission'; request: () => Promise<void> }
  | { status: 'denied'; openSettings: () => Promise<void> }
  | { status: 'unavailable'; retry: () => Promise<void> }
  | { status: 'ready'; place: PlaceName | null; countryCode: string | null; isLastKnown: false }
  | {
      status: 'ready';
      place: PlaceName | null;
      countryCode: string | null;
      isLastKnown: true;
      request: () => Promise<void>;
    };

/** 설정에서 권한을 켜고 돌아오면 위치 query가 포커스에서 다시 확인해 재시작 없이 ready로 바뀐다 */
export function useWeatherLocation(): WeatherLocation {
  const gateway = useDeviceLocation();
  const openSettings = useOpenAppSettings();
  const logger = useLogger();
  const queryClient = useQueryClient();
  const { trackEvent } = useTrack();
  const { data: reading, isError } = useQuery(useGetWeatherLocationQueryOptions());
  const location = match({ reading, isError })
    .returnType<WeatherLocationStatus>()
    .with({ reading: P.nonNullable }, (narrowed) =>
      WeatherLocationPolicy.getLocationStatus(narrowed.reading),
    )
    .with({ isError: true }, () => ({ status: 'unavailable' }))
    .otherwise(() => ({ status: 'checking' }));

  const request = async () => {
    const permission = await gateway.requestPermission().catch((error) => {
      logger.warn(WEATHER_LOG_EVENT.LOCATION_PERMISSION_REQUEST_FAILED, {
        error: getErrorMessage(error),
      });
      return null;
    });
    trackEvent('weather_location_permission_result', {
      result: toPermissionResult(permission),
    });
    await refetchWeatherLocation(queryClient);
  };

  return match(location)
    .with({ status: 'needsPermission' }, () => ({ status: 'needsPermission' as const, request }))
    .with({ status: 'denied' }, () => ({
      status: 'denied' as const,
      openSettings,
    }))
    .with({ status: 'unavailable' }, () => ({
      status: 'unavailable' as const,
      retry: () => refetchWeatherLocation(queryClient),
    }))
    .with({ status: 'ready', isLastKnown: true }, (state) => ({
      ...state,
      isLastKnown: true as const,
      request,
    }))
    .with({ status: 'ready', isLastKnown: false }, (state) => ({
      ...state,
      isLastKnown: false as const,
    }))
    .with({ status: 'checking' }, (state) => state)
    .exhaustive();
}
