/** 빠른 선택이 바꾸는 끝 날짜(오늘 포함 일 수). "1개월"은 30일이라 31일짜리 달에도 무료 기간(30일)을 넘지 않는다 */
export const IMPORT_RANGE_PRESETS = {
  week: 7,
  month: 30,
  quarter: 90,
  half: 180,
  year: 365,
} as const;
export type ImportRangePreset = keyof typeof IMPORT_RANGE_PRESETS;
export const IMPORT_RANGE_PRESET_NAMES = [
  'week',
  'month',
  'quarter',
  'half',
  'year',
] as const satisfies readonly ImportRangePreset[];

/** 연결·서버 장애·속도 제한에 묶음 하나를 다시 보내는 최대 횟수. 넘으면 멈췄다가 온라인·앱 복귀 때 이어 간다 */
export const TODO_IMPORT_MAX_RETRIES = 8;
