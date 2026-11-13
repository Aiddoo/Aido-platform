/** 영속 계약: 배포된 설치의 키체인 키 이름이라 바꾸면 전체 강제 로그아웃이 된다 */
export const STORAGE_KEYS = {
  ACCESS_TOKEN: 'accessToken',
  REFRESH_TOKEN: 'refreshToken',
} as const;

/** 영속 계약: 배포된 설치의 키체인 키 이름이라 바꾸면 기기·설치 id가 새로 생기고 초안을 풀 수 없다 */
export const DEVICE_SECURE_STORAGE_KEYS = {
  INSTALLATION_ID: 'aido_installation_id',
  DEVICE_ID: 'aido_device_id',
  DRAFT_ENCRYPTION_KEY: 'aido_draft_encryption_key',
} as const;
