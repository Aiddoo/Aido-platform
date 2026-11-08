import { useSystemLocale } from '@src/shared/infra/localization/device-locale';

import type { TemperatureUnit } from '../utils/weather-temperature';

export function useTemperatureUnit(): TemperatureUnit {
  return useSystemLocale().temperatureUnit ?? 'celsius';
}
