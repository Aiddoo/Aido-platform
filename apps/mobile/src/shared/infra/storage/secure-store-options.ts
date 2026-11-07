import * as SecureStore from 'expo-secure-store';

// AFTER_FIRST_UNLOCK: 첫 잠금해제 후 접근 가능(잠금 중 백그라운드 접근 throw 방지), 재설치해도 유지.
//
// ⚠️ 영속 계약: keychainAccessible(및 keychainService/accessGroup 미설정)은 이미 배포된
// 설치의 키체인 항목 접근 조건이다. 옵션을 바꾸면 기존 항목을 읽지 못해 전체 강제
// 로그아웃이 될 수 있다 — 변경이 불가피하면 구 옵션으로 읽어 재저장하는 마이그레이션 필수.
export const SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};
