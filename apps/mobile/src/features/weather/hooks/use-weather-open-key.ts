import { useRouteParams } from '@src/shared/hooks/use-route-params';

import { weatherEntryParamsSchema } from '../schemas/weather-entry-params.schema';

/** 날씨 화면을 연 한 번. Stack에 남은 화면이 다시 올라와도 링크가 붙인 연 시각이 달라 다른 값이다(`toWeatherHref`) */
export function useWeatherOpenKey(): string {
  const [{ entry, openedAt }] = useRouteParams(weatherEntryParamsSchema);

  return `${entry ?? 'other'}:${openedAt ?? 0}`;
}
