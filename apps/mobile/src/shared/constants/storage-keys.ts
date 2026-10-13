/**
 * SecureStore(키체인)에 저장하는 인증 토큰 키.
 * 앱 전역에서 이 상수만 사용해 오타·불일치를 방지한다.
 *
 * ⚠️ 영속 계약: 이 키 이름은 이미 배포된 모든 설치의 키체인 데이터를 가리킨다.
 * 이름을 바꾸면 기존 유저의 토큰을 읽지 못해 전체 강제 로그아웃이 된다 —
 * 변경이 불가피하면 구 키 → 신 키 마이그레이션을 반드시 함께 배포한다.
 */
export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'accessToken',
  REFRESH_TOKEN: 'refreshToken',
} as const;
