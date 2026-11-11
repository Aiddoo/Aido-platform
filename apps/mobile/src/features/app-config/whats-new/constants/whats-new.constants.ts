import { DAY_MS } from '@src/shared/constants/time-units';
import type { ResolvedLanguage } from '@src/shared/preferences/language.preference';

/** 처음 본 뒤 피드 카드로 다시 열 수 있는 기간 */
export const WHATS_NEW_REENTRY_WINDOW_MS = 14 * DAY_MS;

/** 목록 줄의 route·지표 키. 기능 출시마다 하나씩 쌓고 지우지 않는다 */
export const RELEASE_ID = {
  v1_15_0: '1.15.0',
  v1_14_0: '1.14.0',
} as const;

/** 여러 단계 소개를 앱에 남긴 출시. 최근 두 출시만이고 최신이 앞이다 */
export const TOUR_RELEASE_IDS = [RELEASE_ID.v1_15_0, RELEASE_ID.v1_14_0] as const;

/** 지난 업데이트 전체(고친 점 포함)는 앱에 묶지 않고 랜딩 패치 노트로 연다. www를 붙이면 308 리다이렉트가 생긴다 */
export const PATCH_NOTES_URL = {
  ko: 'https://aido.kr/ko/patch-notes',
  en: 'https://aido.kr/en/patch-notes',
} as const satisfies Record<ResolvedLanguage, string>;
