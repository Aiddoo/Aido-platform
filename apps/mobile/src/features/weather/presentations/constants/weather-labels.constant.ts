import type { PrecipitationType, SkyCondition } from '@aido/validators';
import { t } from '@src/shared/i18n';

const SKY_CONDITION_LABEL_KEYS = {
  CLEAR: 'weather:sky.clear',
  PARTLY_CLOUDY: 'weather:sky.partlyCloudy',
  CLOUDY: 'weather:sky.cloudy',
} as const satisfies Record<SkyCondition, string>;

const PRECIPITATION_TYPE_LABEL_KEYS = {
  RAIN: 'weather:precipitation.rain',
  RAIN_SNOW: 'weather:precipitation.rainSnow',
  SNOW: 'weather:precipitation.snow',
  SHOWER: 'weather:precipitation.shower',
} as const satisfies Record<Exclude<PrecipitationType, 'NONE'>, string>;

export const getSkyConditionLabel = (condition: SkyCondition): string =>
  t(SKY_CONDITION_LABEL_KEYS[condition]);

/** NONE은 표시 텍스트가 없으므로 빈 문자열 */
export const getPrecipitationTypeLabel = (type: PrecipitationType): string => {
  if (type === 'NONE') {
    return '';
  }
  return t(PRECIPITATION_TYPE_LABEL_KEYS[type]);
};
