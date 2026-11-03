import { useLocationGateway, useLogger } from '@src/bootstrap/providers/di-context';
import { useTrack } from '@src/shared/analytics';
import { toError } from '@src/shared/errors';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import { match } from 'ts-pattern';

import { WEATHER_LOG_EVENT } from '../constants/weather-log-events';
import { type PlaceName, WeatherLocationPolicy } from '../domains/weather-location.model';
import { useGetWeatherLocationQueryOptions } from '../queries/get-weather-location-query-options';
import { refetchWeatherLocation } from '../queries/weather-cache';

export type WeatherLocation =
  | { status: 'checking' }
  | { status: 'needsPermission'; request: () => Promise<void> }
  | { status: 'denied'; openSettings: () => Promise<void> }
  | { status: 'unavailable'; retry: () => Promise<void> }
  | { status: 'ready'; place: PlaceName | null; countryCode: string | null };

/**
 * 위치 권한·위치 읽기·서버 등록을 화면이 그릴 상태 하나로 모은다.
 * 설정에서 권한을 켜고 돌아오면 위치 query가 포커스에서 다시 확인해 재시작 없이 ready로 바뀐다.
 */
export function useWeatherLocation(): WeatherLocation {
  const gateway = useLocationGateway();
  const logger = useLogger();
  const queryClient = useQueryClient();
  const { trackEvent } = useTrack();
  const { data, isError } = useQuery(useGetWeatherLocationQueryOptions());
  const location = WeatherLocationPolicy.status(data, { hasFailed: isError });

  return match(location)
    .with({ status: 'needsPermission' }, () => ({
      status: 'needsPermission' as const,
      request: async () => {
        const permission = await gateway.requestPermission().catch((error) => {
          logger.warn(WEATHER_LOG_EVENT.LOCATION_PERMISSION_REQUEST_FAILED, {
            error: toError(error).message,
          });
          return null;
        });
        trackEvent('weather_location_permission_result', {
          result: WeatherLocationPolicy.permissionResult(permission),
        });
        await refetchWeatherLocation(queryClient);
      },
    }))
    .with({ status: 'denied' }, () => ({
      status: 'denied' as const,
      openSettings: () =>
        Linking.openSettings().catch((error) => {
          logger.warn(WEATHER_LOG_EVENT.LOCATION_SETTINGS_OPEN_FAILED, {
            error: toError(error).message,
          });
        }),
    }))
    .with({ status: 'unavailable' }, () => ({
      status: 'unavailable' as const,
      retry: () => refetchWeatherLocation(queryClient),
    }))
    .with({ status: 'checking' }, { status: 'ready' }, (state) => state)
    .exhaustive();
}
