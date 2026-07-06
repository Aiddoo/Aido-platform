/**
 * SecureStore(키체인)에 저장하는 인증 토큰 키.
 * 앱 전역에서 이 상수만 사용해 오타·불일치를 방지한다.
 */
export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'accessToken',
  REFRESH_TOKEN: 'refreshToken',
} as const;
