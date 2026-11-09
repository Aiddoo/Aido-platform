import { useQuery } from '@tanstack/react-query';

import { WeatherLocationPolicy } from '../domains/weather-location.model';
import { useGetWeatherReportQueryOptions, WeatherReportSelect } from '../queries/weather.queries';
import {
  toWeatherScene,
  type WeatherScene,
  type WeatherSceneInput,
} from '../utils/weather-scene.view-model';
import { useWeatherLocation } from './use-weather-location';

/** 리포트를 받기 전·권한 안내 중에는 맑은 낮 하늘을 바탕으로 둔다. */
const DEFAULT_SCENE_INPUT: WeatherSceneInput = {
  condition: 'CLEAR',
  isDaylight: true,
  precipitationIntensity: 0,
  cloudCover: 0,
  windSpeed: 0,
  moonPhase: null,
  latitude: 0,
};

/** 리포트가 없거나 실패해도 화면을 막지 않도록 Suspense·오류 경계 밖에서 구독한다 */
export function useWeatherScene(): WeatherScene {
  const location = useWeatherLocation();
  const { data: sceneInput } = useQuery({
    ...useGetWeatherReportQueryOptions(),
    select: WeatherReportSelect.scene,
    enabled: WeatherLocationPolicy.shouldFetchReport(location),
  });
  return toWeatherScene(sceneInput ?? DEFAULT_SCENE_INPUT);
}
