import type { KeyValueStorage } from '@src/core/ports/key-value-storage';
import { getErrorMessage, KeychainLockedError } from '@src/shared/errors';
import { parseStoredJson } from '@src/shared/utils/parse-stored-json';
import * as ExpoSecureStore from 'expo-secure-store';
import type { z } from 'zod';

import { SECURE_STORE_OPTIONS } from './secure-store-options';

// expo-secure-store는 OSStatus를 메시지로만 노출해 `code`로는 잠금과 영구 오류를 구분할 수 없다. `instanceof Error`를 관문으로 두면 `{ message }` 객체를 놓쳐 잠긴 키체인이 로그아웃이 된다
// Android에는 잠금 개념이 없어 `DecryptException` 등은 영구 오류로 둔다
const IOS_LOCKED_KEYCHAIN_MESSAGE = 'User interaction is not allowed.';

function hasLockedKeychainMessage(error: unknown): boolean {
  return getErrorMessage(error).includes(IOS_LOCKED_KEYCHAIN_MESSAGE);
}

async function readItem(key: string): Promise<string | null> {
  try {
    return await ExpoSecureStore.getItemAsync(key, SECURE_STORE_OPTIONS);
  } catch (error) {
    // 일시적(잠김)만 타입으로 승격한다. 나머지는 원본 그대로 — 상위에서 리포팅 후 폴백한다.
    if (hasLockedKeychainMessage(error)) {
      throw new KeychainLockedError(error);
    }
    throw error;
  }
}

export class SecureStorage implements KeyValueStorage {
  get = async <T>(key: string, schema: z.ZodType<T>): Promise<T | null> =>
    parseStoredJson(await readItem(key), schema);

  set = async <T>(key: string, value: T): Promise<void> => {
    await ExpoSecureStore.setItemAsync(key, JSON.stringify(value), SECURE_STORE_OPTIONS);
  };

  remove = async (key: string): Promise<void> => {
    await ExpoSecureStore.deleteItemAsync(key, SECURE_STORE_OPTIONS);
  };
}
