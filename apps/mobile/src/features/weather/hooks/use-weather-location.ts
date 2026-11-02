import { useLocationGateway } from '@src/bootstrap/providers/di-context';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import { match } from 'ts-pattern';

import {
  UNLOCATED_REVISION,
  WeatherLocationPolicy,
  type WeatherLocationStatus,
} from '../domains/weather-location.model';
import { useGetWeatherLocationQueryOptions } from '../queries/get-weather-location-query-options';
import { refetchWeatherLocation } from '../queries/weather-cache';

export type WeatherLocation =
  | { status: 'checking' }
  | { status: 'needsPermission'; request: () => Promise<void> }
  | { status: 'denied'; openSettings: () => Promise<void> }
  | { status: 'ready'; locationRevision: string; placeName: string | null };

function useWeatherLocationStatus(): WeatherLocationStatus {
  const { data, isError } = useQuery(useGetWeatherLocationQueryOptions());
  return WeatherLocationPolicy.status(data, { hasFailed: isError });
}

export function useWeatherLocation(): WeatherLocation {
  const gateway = useLocationGateway();
  const queryClient = useQueryClient();
  const location = useWeatherLocationStatus();

  return match(location)
    .with({ status: 'needsPermission' }, () => ({
      status: 'needsPermission' as const,
      request: async () => {
        await gateway.requestPermission().catch(() => null);
        await refetchWeatherLocation(queryClient);
      },
    }))
    .with({ status: 'denied' }, () => ({
      status: 'denied' as const,
      openSettings: () => Linking.openSettings().catch(() => undefined),
    }))
    .with({ status: 'checking' }, { status: 'ready' }, (state) => state)
    .exhaustive();
}

/** 날씨 블록이 같은 리포트 캐시를 고르도록 현재 위치 리비전을 돌려준다. */
export function useWeatherLocationRevision(): string {
  const location = useWeatherLocationStatus();
  return location.status === 'ready' ? location.locationRevision : UNLOCATED_REVISION;
}
