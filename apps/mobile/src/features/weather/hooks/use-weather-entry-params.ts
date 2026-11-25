import { useRouteParams } from '@src/shared/hooks/use-route-params';

import { weatherEntryParamsSchema } from '../schemas/weather-entry-params.schema';

/** 링크가 진입점·연 시각을 붙이지 않은 열기(딥 링크·되돌아오기). 화면이 떠 있는 동안 한 번으로 센다 */
const UNSTAMPED_OPEN = { entry: 'other', openedAt: 0 } as const;

/** 날씨 화면으로 들어온 곳. 링크가 정하고 화면은 바꾸지 않는다 */
export function useWeatherEntry() {
  const [{ entry }] = useRouteParams(weatherEntryParamsSchema);

  return [entry] as const;
}

/** 날씨 화면을 연 한 번. Stack에 남은 화면이 다시 올라와도 링크가 붙인 연 시각이 달라 다른 값이다(`toWeatherHref`) */
export function useWeatherOpenKey() {
  const [{ entry, openedAt }] = useRouteParams(weatherEntryParamsSchema);
  const openKey = `${entry ?? UNSTAMPED_OPEN.entry}:${openedAt ?? UNSTAMPED_OPEN.openedAt}`;

  return [openKey] as const;
}
