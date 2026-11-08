export const VISIBLE_PRECIPITATION_CHANCE = 20;

/** 기기에 저장된 위치로 받은 리포트의 리비전. 새로 등록할 때마다 1씩 올린다 */
export const SAVED_LOCATION_REVISION = 0;

/** 환경부 통합 예보 기준 (μg/m³). 각 값 이하가 해당 등급이다. 등급 판정과 막대 눈금이 함께 쓴다 */
export const PM10_UPPER_BOUNDS = [30, 80, 150] as const;
export const PM25_UPPER_BOUNDS = [15, 35, 75] as const;
