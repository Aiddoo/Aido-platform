import type { Storage } from '@src/core/ports/storage';
import { getErrorMessage, KeychainLockedError } from '@src/shared/errors';
import * as ExpoSecureStore from 'expo-secure-store';
import type { z } from 'zod';

import { SECURE_STORE_OPTIONS } from './secure-store-options';

/**
 * iOS `errSecInteractionNotAllowed`의 메시지.
 *
 * expo-secure-store의 `KeyChainException`은 OSStatus를 **메시지로만** 노출한다
 * (`code`는 클래스명에서 파생되므로 잠금과 영구 오류를 구분하지 못한다).
 * 벤더의 에러 형태를 아는 것은 이 인프라 경계의 책임이다 — 도메인이 문자열을 알아선 안 된다.
 *
 * Android에는 잠금 개념이 없다(`requireAuthentication` 미사용). `DecryptException` 등은
 * 영구 오류이므로 잠김으로 승격하지 않는다.
 *
 * `instanceof Error`를 관문으로 두지 않는다 — 네이티브 브릿지가 `{ message }` 형태의
 * 평범한 객체를 던지면 판별에 실패해 **잠긴 키체인이 곧 로그아웃**이 된다.
 */
const IOS_LOCKED_KEYCHAIN_MESSAGE = 'User interaction is not allowed.';

function hasLockedKeychainMessage(error: unknown): boolean {
  return getErrorMessage(error).includes(IOS_LOCKED_KEYCHAIN_MESSAGE);
}

export class SecureStorage implements Storage {
  async get<T>(key: string, schema: z.ZodType<T>): Promise<T | null> {
    let item: string | null;
    try {
      item = await ExpoSecureStore.getItemAsync(key, SECURE_STORE_OPTIONS);
    } catch (error) {
      // 일시적(잠김)만 타입으로 승격한다. 나머지는 원본 그대로 — 상위에서 리포팅 후 폴백한다.
      if (hasLockedKeychainMessage(error)) {
        throw new KeychainLockedError(error);
      }
      throw error;
    }

    if (!item) {
      return null;
    }

    let storedValue: unknown;
    try {
      storedValue = JSON.parse(item);
    } catch {
      return null;
    }

    const parsed = schema.safeParse(storedValue);
    return parsed.success ? parsed.data : null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    await ExpoSecureStore.setItemAsync(key, JSON.stringify(value), SECURE_STORE_OPTIONS);
  }

  async remove(key: string): Promise<void> {
    await ExpoSecureStore.deleteItemAsync(key, SECURE_STORE_OPTIONS);
  }
}
