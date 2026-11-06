import { DAY_MS } from './time.constants';

/** 앱을 다시 열었을 때 복원할 캐시의 최대 나이. 이보다 오래된 캐시는 버린다 */
export const QUERY_CACHE_MAX_AGE_MS = DAY_MS;

/**
 * 오프라인 복원에 opt-in하는 조회 옵션. 화면에 이미 보이는 읽기 모델에만 붙인다(토큰·결제·배지 제외).
 * gcTime이 maxAge보다 짧으면 저장한 캐시가 복원 전에 지워진다.
 */
export const PERSISTED_QUERY_OPTIONS = {
  meta: { persist: true },
  gcTime: QUERY_CACHE_MAX_AGE_MS,
} as const;
