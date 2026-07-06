import type { Storage } from '@src/core/ports/storage';
import * as ExpoSecureStore from 'expo-secure-store';

// AFTER_FIRST_UNLOCK: 첫 잠금해제 후 접근 가능(잠금 중 백그라운드 접근 throw 방지), 재설치해도 유지.
// DeviceIdRepository와 동일한 회복력 정책으로 정렬한다.
const SECURE_STORE_OPTIONS: ExpoSecureStore.SecureStoreOptions = {
  keychainAccessible: ExpoSecureStore.AFTER_FIRST_UNLOCK,
};

export class SecureStorage implements Storage {
  async get<T>(key: string): Promise<T | null> {
    const item = await ExpoSecureStore.getItemAsync(key, SECURE_STORE_OPTIONS);
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
