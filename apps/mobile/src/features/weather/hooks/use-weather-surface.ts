import { useReduceTransparency } from '@src/shared/hooks/use-reduce-transparency';
import { useQuery } from '@tanstack/react-query';
import { useUniwind } from 'uniwind';

import { toWeatherScene, type WeatherSceneSky } from '../components/weather-scene/weather-scene';
import { WEATHER_SCENE_PALETTES } from '../constants/weather-scene-palette';
import type { WeatherReport } from '../domains/weather-report.model';
import {
  useGetWeatherReportQueryOptions,
  WeatherReportSelect,
} from '../queries/get-weather-report-query-options';
import { useOnSkyColor } from './use-on-sky-color';

const DEFAULT_SKY: WeatherSceneSky = 'clearDay';
const OPAQUE_DARK_CARD = 'rgb(30,33,40)';

export type WeatherSurface = {
  /** 카드 면 색 */
  card: string;
  /** 카드 안쪽 0.5pt 테두리 색 */
  cardEdge: string;
  /** 막대 위 현재 값 점을 감싸는 링 색 */
  nowRing: string;
  /** 투명도 줄이기가 켜져 블러 없이 불투명하게 그려야 하는지 */
  isOpaque: boolean;
};

function selectSky(report: WeatherReport): WeatherSceneSky {
  return toWeatherScene(WeatherReportSelect.scene(report)).sky;
}

/**
 * 하늘 장면 색조를 따라가는 유리 카드 색. 리포트를 받기 전에는 맑은 낮 색조를 쓴다.
 * 요청은 각 블록의 Suspense 쿼리가 하므로 여기서는 캐시만 구독한다.
 */
export function useWeatherSurface(): WeatherSurface {
  const { theme } = useUniwind();
  const isOpaque = useReduceTransparency();
  const { data: sky = DEFAULT_SKY } = useQuery({
    ...useGetWeatherReportQueryOptions(),
    select: selectSky,
    enabled: false,
  });
  const { tint } = WEATHER_SCENE_PALETTES[sky];
  const isDark = theme === 'dark';
  const darkEdge = useOnSkyColor('text-on-sky/10') ?? '';
  const lightEdge = useOnSkyColor('text-on-sky/16') ?? '';
  const darkCard = useOnSkyColor('text-on-sky/7') ?? '';
  const cardEdge = isDark ? darkEdge : lightEdge;

  if (isOpaque) {
    return {
      card: isDark ? OPAQUE_DARK_CARD : `rgb(${tint})`,
      cardEdge,
      nowRing: isDark ? OPAQUE_DARK_CARD : `rgb(${tint})`,
      isOpaque,
    };
  }
  return {
    card: isDark ? darkCard : `rgba(${tint},0.24)`,
    cardEdge,
    nowRing: isDark ? 'rgba(10,14,24,0.6)' : `rgba(${tint},0.55)`,
    isOpaque,
  };
}
