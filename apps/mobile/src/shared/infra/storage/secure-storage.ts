import { KeychainLockedError, type Storage } from '@src/core/ports/storage';
import * as ExpoSecureStore from 'expo-secure-store';

// AFTER_FIRST_UNLOCK: 첫 잠금해제 후 접근 가능(잠금 중 백그라운드 접근 throw 방지), 재설치해도 유지.
// DeviceIdRepository와 동일한 회복력 정책으로 정렬한다.
//
// ⚠️ 영속 계약: keychainAccessible(및 keychainService/accessGroup 미설정)은 이미 배포된
// 설치의 키체인 항목 접근 조건이다. 옵션을 바꾸면 기존 항목을 읽지 못해 전체 강제
// 로그아웃이 될 수 있다 — 변경이 불가피하면 구 옵션으로 읽어 재저장하는 마이그레이션 필수.
const SECURE_STORE_OPTIONS: ExpoSecureStore.SecureStoreOptions = {
  keychainAccessible: ExpoSecureStore.AFTER_FIRST_UNLOCK,
};

/**
 * iOS `errSecInteractionNotAllowed`의 메시지.
 *
 * expo-secure-store의 `KeyChainException`은 OSStatus를 **메시지로만** 노출한다
 * (`code`는 클래스명에서 파생되므로 잠금과 영구 오류를 구분하지 못한다).
 * 벤더의 에러 형태를 아는 것은 이 인프라 경계의 책임이다 — 도메인이 문자열을 알아선 안 된다.
 *
 * Android에는 잠금 개념이 없다(`requireAuthentication` 미사용). `DecryptException` 등은
 * 영구 오류이므로 잠김으로 승격하지 않는다.
 */
const IOS_LOCKED_KEYCHAIN_MESSAGE = 'User interaction is not allowed.';

const isLockedKeychain = (error: unknown): boolean =>
  error instanceof Error && error.message.includes(IOS_LOCKED_KEYCHAIN_MESSAGE);

export class SecureStorage implements Storage {
  async get<T>(key: string): Promise<T | null> {
    let item: string | null;
    try {
      item = await ExpoSecureStore.getItemAsync(key, SECURE_STORE_OPTIONS);
    } catch (error) {
      // 일시적(잠김)만 타입으로 승격한다. 나머지는 원본 그대로 — 상위에서 리포팅 후 폴백한다.
      if (isLockedKeychain(error)) {
        throw new KeychainLockedError(error);
      }
      throw error;
    }

    if (!item) return null;

    try {
      return JSON.parse(item) as T;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    await ExpoSecureStore.setItemAsync(key, JSON.stringify(value), SECURE_STORE_OPTIONS);
  }

  async remove(key: string): Promise<void> {
    await ExpoSecureStore.deleteItemAsync(key, SECURE_STORE_OPTIONS);
  }

  async clear(): Promise<void> {
    // expo-secure-store doesn't have a clear method
    // You need to manually track and remove keys if needed
    throw new Error('Clear method is not implemented for SecureStorage');
  }
}
