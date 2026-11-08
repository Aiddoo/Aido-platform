import * as SecureStore from 'expo-secure-store';

// AFTER_FIRST_UNLOCK: 잠금 중 백그라운드 접근 throw를 막고 재설치해도 유지된다
// 영속 계약: 배포된 설치의 키체인 접근 조건이라 바꾸면 전체 강제 로그아웃이 될 수 있다(구 옵션으로 읽어 재저장하는 마이그레이션 필수)
export const SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};
