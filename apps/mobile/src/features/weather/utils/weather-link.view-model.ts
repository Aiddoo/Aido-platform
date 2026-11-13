import type { WeatherEntry } from '../schemas/weather-entry-params.schema';

/**
 * 날씨 화면 경로. 날씨는 앱 Stack에 하나만 두어(dangerouslySingular) 남아 있으면 그 화면이 다시 올라온다.
 * 연 시각을 붙여야 다시 마운트되지 않아도 화면이 열 때마다 `weather_opened`를 센다(1.15.1과 같은 수)
 */
export function toWeatherHref({ entry, openedAt }: { entry: WeatherEntry; openedAt: number }) {
  return { pathname: '/weather', params: { entry, openedAt } } as const;
}
