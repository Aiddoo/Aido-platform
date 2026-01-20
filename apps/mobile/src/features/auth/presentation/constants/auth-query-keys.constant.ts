/**
 * Auth Query Keys (Presentation Layer)
 *
 * TanStack Query의 queryKey 패턴을 정의합니다.
 * 계층적 구조로 세밀한 캐시 무효화가 가능합니다.
 */

export const AUTH_QUERY_KEYS = {
  all: ['auth'] as const,
  me: () => [...AUTH_QUERY_KEYS.all, 'me'] as const,
} as const;
