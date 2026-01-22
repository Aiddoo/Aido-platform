import type { Storage } from '@src/core/ports/storage';
import * as ExpoSecureStore from 'expo-secure-store';

export class SecureStorage implements Storage {
  async get<T>(key: string): Promise<T | null> {
    const item = await ExpoSecureStore.getItemAsync(key);
    if (!item) return null;

    try {
      return JSON.parse(item) as T;
    } catch {
      return null;
    }
  }

  async set<T>(key: string, value: T): Promise<void> {
    await ExpoSecureStore.setItemAsync(key, JSON.stringify(value));
  }

  async remove(key: string): Promise<void> {
    await ExpoSecureStore.deleteItemAsync(key);
  }

  async clear(): Promise<void> {
    // expo-secure-store doesn't have a clear method
    // You need to manually track and remove keys if needed
    throw new Error('Clear method is not implemented for SecureStorage');
  }
}
