import type { ResolvedLanguage } from '@src/shared/preferences/language.preference';

import type { ReleaseId } from '../domains/whats-new.model';

/** 출시 id를 코드에서 부르는 이름. id 목록과 소개가 있는 출시는 모델이 정한다 */
export const RELEASE_ID = {
  v1_15_0: '1.15.0',
  v1_14_0: '1.14.0',
} as const satisfies Record<string, ReleaseId>;

/** 지난 업데이트 전체(고친 점 포함)는 앱에 묶지 않고 랜딩 패치 노트로 연다. www를 붙이면 308 리다이렉트가 생긴다 */
export const PATCH_NOTES_URL = {
  ko: 'https://aido.kr/ko/patch-notes',
  en: 'https://aido.kr/en/patch-notes',
} as const satisfies Record<ResolvedLanguage, string>;
