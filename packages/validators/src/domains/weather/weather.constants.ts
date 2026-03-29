export const SKY_CONDITION = {
  CLEAR: 'CLEAR',
  PARTLY_CLOUDY: 'PARTLY_CLOUDY',
  CLOUDY: 'CLOUDY',
} as const;

export type SkyCondition = (typeof SKY_CONDITION)[keyof typeof SKY_CONDITION];

export const SKY_CONDITIONS = ['CLEAR', 'PARTLY_CLOUDY', 'CLOUDY'] as const;

export const PRECIPITATION_TYPE = {
  NONE: 'NONE',
  RAIN: 'RAIN',
  RAIN_SNOW: 'RAIN_SNOW',
  SNOW: 'SNOW',
  SHOWER: 'SHOWER',
} as const;

export type PrecipitationType = (typeof PRECIPITATION_TYPE)[keyof typeof PRECIPITATION_TYPE];

export const PRECIPITATION_TYPES = ['NONE', 'RAIN', 'RAIN_SNOW', 'SNOW', 'SHOWER'] as const;

/** 한국 위도 범위 (WGS84) */
export const LATITUDE_RANGE = {
  MIN: 33.0,
  MAX: 39.0,
} as const;

/** 한국 경도 범위 (WGS84) */
export const LONGITUDE_RANGE = {
  MIN: 124.0,
  MAX: 132.0,
} as const;
