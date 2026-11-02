import { useLocationGateway, useWeatherService } from '@src/bootstrap/providers/di-context';
import type { LocationGateway } from '@src/core/ports/location-gateway';
import type { WeatherService } from '@src/features/weather/apis/weather.service';
import { unwrap } from '@src/shared/errors';
import { queryOptions, type Query } from '@tanstack/react-query';

import { WEATHER_QUERY_KEYS } from '../constants/weather-query-keys';
import { type LocationReading, WeatherLocationPolicy } from '../domains/weather-location.model';
import { WeatherErrors } from '../domains/weather.error';

const LOCATION_STALE_TIME_MS = 30 * 60_000;

/** 권한이 없던 사용자가 설정에서 돌아오면 30분을 기다리지 않고 바로 다시 확인한다. */
function refetchOnFocus(query: Query<LocationReading, Error>) {
  return query.state.data?.status === 'located' ? true : 'always';
}

/**
 * 기기 위치를 읽고, 직전에 등록한 위치에서 충분히 움직였을 때만 서버에 다시 등록한다.
 * 등록을 이 query 안에서 하는 이유: 피드 배지·날씨 화면·안내가 같은 key를 구독하므로
 * 동시에 열려도 위치 읽기와 PUT이 한 번만 일어난다.
 */
export function getWeatherLocationQueryOptions(
  gateway: LocationGateway,
  weatherService: WeatherService,
) {
  return queryOptions({
    queryKey: WEATHER_QUERY_KEYS.location(),
    queryFn: async ({ signal, client, queryKey }): Promise<LocationReading> => {
      const permission = await gateway.getPermission();
      if (!permission.granted) {
        return { status: permission.canAskAgain ? 'needsPermission' : 'denied' };
      }

      const previous = client.getQueryData<LocationReading>(queryKey);
      const previousLocated = previous?.status === 'located' ? previous : null;
      const coordinates = await gateway.getCoordinates(signal).catch(() => null);
      if (coordinates == null) {
        if (previousLocated != null) {
          return previousLocated;
        }
        throw WeatherErrors.locationUnavailable();
      }
      const place = await gateway.getPlace(coordinates, signal);

      if (
        previousLocated != null &&
        !WeatherLocationPolicy.isRelocationNeeded(coordinates, previousLocated.registered)
      ) {
        return { ...previousLocated, placeName: place.name ?? previousLocated.placeName };
      }

      const registered = unwrap(await weatherService.registerLocation(coordinates, signal));
      return { status: 'located', registered, placeName: place.name };
    },
    staleTime: LOCATION_STALE_TIME_MS,
    gcTime: Infinity,
    retry: false,
    refetchOnWindowFocus: refetchOnFocus,
  });
}

export function useGetWeatherLocationQueryOptions() {
  return getWeatherLocationQueryOptions(useLocationGateway(), useWeatherService());
}
