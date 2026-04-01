import type { PrecipitationType, SkyCondition } from '@aido/validators';

export const SKY_CONDITION_LABEL: Record<SkyCondition, string> = {
  CLEAR: '맑음',
  PARTLY_CLOUDY: '구름많음',
  CLOUDY: '흐림',
};

export const PRECIPITATION_TYPE_LABEL: Record<PrecipitationType, string> = {
  NONE: '',
  RAIN: '비',
  RAIN_SNOW: '비/눈',
  SNOW: '눈',
  SHOWER: '소나기',
};
