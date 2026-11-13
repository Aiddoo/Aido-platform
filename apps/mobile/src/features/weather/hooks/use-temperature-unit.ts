import { useSystemLocale } from '@src/shared/infra/localization/device-locale';

import type { TemperatureUnit } from '../utils/weather-temperature.view-model';

/** 기기 지역 설정의 온도 단위. 실행 중 설정을 바꾸면 다시 렌더된다. */
export function useTemperatureUnit(): TemperatureUnit {
  return useSystemLocale().temperatureUnit ?? 'celsius';
}
