import { useTrack } from '@src/shared/analytics';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';

import type { WeatherLocationStatus } from '../domains/weather-location.model';
import { weatherEntryParamsSchema } from '../schemas/weather-entry-params.schema';
import {
  toWeatherLocationRegisteredResult,
  toWeatherOpenedEntry,
} from '../utils/weather-analytics';

/**
 * 날씨 화면이 열릴 때 진입점을, 위치 확인이 처음 끝났을 때 그 결과를 한 번씩 남긴다.
 * 새로고침·포커스 재확인으로 상태가 다시 바뀌어도 같은 화면에서는 더 세지 않는다.
 */
export function useWeatherScreenTracking(locationStatus: WeatherLocationStatus['status']): void {
  const { entry } = weatherEntryParamsSchema.parse(useLocalSearchParams());
  const { trackEvent } = useTrack();
  const hasTrackedLocation = useRef(false);
  const locationResult = toWeatherLocationRegisteredResult(locationStatus);

  useEffect(() => {
    trackEvent('weather_opened', { entry: toWeatherOpenedEntry(entry) });
  }, [trackEvent, entry]);

  useEffect(() => {
    if (locationResult == null || hasTrackedLocation.current) {
      return;
    }
    hasTrackedLocation.current = true;
    trackEvent('weather_location_registered', { result: locationResult });
  }, [trackEvent, locationResult]);
}
