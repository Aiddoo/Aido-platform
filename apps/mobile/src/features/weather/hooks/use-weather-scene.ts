import { fromEpochMs } from '@src/shared/date/instant';
import { useQuery } from '@tanstack/react-query';

import {
  toWeatherScene,
  type WeatherScene,
  type WeatherSceneInput,
} from '../components/weather-scene/weather-scene';
import { WeatherLocationPolicy } from '../domains/weather-location.model';
import { useGetWeatherReportQueryOptions, WeatherReportSelect } from '../queries/weather.queries';
import { useWeatherLocation } from './use-weather-location';

/** 리포트를 받기 전·권한 안내 중에는 맑은 낮 하늘을 바탕으로 둔다. */
const DEFAULT_SCENE_INPUT: WeatherSceneInput = {
  condition: 'CLEAR',
  isDaylight: true,
  precipitationIntensity: 0,
  cloudCover: 0,
  windSpeed: 0,
  observedAt: fromEpochMs(Date.now()),
  latitude: 0,
};

/**
 * 하늘 장면은 리포트가 없거나 실패해도 화면을 막지 않도록 Suspense·오류 경계 밖에서 구독하고,
 * 받기 전에는 기본 장면을 돌려준다. 배경과 헤더 아래 페이드가 같은 장면을 그린다.
 */
export function useWeatherScene(): WeatherScene {
  const location = useWeatherLocation();
  const { data: sceneInput } = useQuery({
    ...useGetWeatherReportQueryOptions(),
    select: WeatherReportSelect.scene,
    enabled: WeatherLocationPolicy.canFetchReport(location.status),
  });
  return toWeatherScene(sceneInput ?? DEFAULT_SCENE_INPUT);
}
