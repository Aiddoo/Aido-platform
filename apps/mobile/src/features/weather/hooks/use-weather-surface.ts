import { useResolvedColor } from '@src/shared/hooks/use-resolved-color';
import { useQuery } from '@tanstack/react-query';
import { useUniwind } from 'uniwind';

import { WEATHER_SCENE_PALETTES } from '../constants/weather-scene-palette.constants';
import type { WeatherReport } from '../domains/weather-report.model';
import { useGetWeatherReportQueryOptions, WeatherReportSelect } from '../queries/weather.queries';
import { toWeatherScene, type WeatherSceneSky } from '../utils/weather-scene.view-model';
import { useIsReduceTransparencyEnabled } from './use-is-reduce-transparency-enabled';

const DEFAULT_SKY: WeatherSceneSky = 'clearDay';
const OPAQUE_DARK_CARD = 'rgb(30,33,40)';
const LIGHT_CARD_ALPHA = 0.24;
const LIGHT_NOW_RING_ALPHA = 0.55;
const DARK_NOW_RING = 'rgba(10,14,24,0.6)';

export type WeatherSurface = {
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

/** 요청은 각 블록의 Suspense 쿼리가 하므로 여기서는 캐시만 구독한다 */
export function useWeatherSurface(): WeatherSurface {
  const { theme } = useUniwind();
  const isOpaque = useIsReduceTransparencyEnabled();
  const { data: sky = DEFAULT_SKY } = useQuery({
    ...useGetWeatherReportQueryOptions(),
    select: selectSky,
    enabled: false,
  });
  const { tint } = WEATHER_SCENE_PALETTES[sky];
  const isDark = theme === 'dark';
  const darkEdge = useResolvedColor('text-on-sky/10') ?? '';
  const lightEdge = useResolvedColor('text-on-sky/16') ?? '';
  const darkCard = useResolvedColor('text-on-sky/7') ?? '';
  const cardEdge = isDark ? darkEdge : lightEdge;

  if (isOpaque) {
    const opaqueColor = isDark ? OPAQUE_DARK_CARD : `rgb(${tint})`;
    return { card: opaqueColor, cardEdge, nowRing: opaqueColor, isOpaque };
  }
  return {
    card: isDark ? darkCard : `rgba(${tint},${LIGHT_CARD_ALPHA})`,
    cardEdge,
    nowRing: isDark ? DARK_NOW_RING : `rgba(${tint},${LIGHT_NOW_RING_ALPHA})`,
    isOpaque,
  };
}
