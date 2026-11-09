import { DAY_MS } from '@src/shared/constants/time-units';

/** 처음 본 뒤 피드 카드로 다시 열 수 있는 기간 */
export const WHATS_NEW_REENTRY_WINDOW_MS = 14 * DAY_MS;

export const RELEASE_ID = {
  v1_15_0: '1.15.0',
  v1_14_0: '1.14.0',
} as const;
