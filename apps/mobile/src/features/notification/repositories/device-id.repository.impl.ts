import * as SecureStore from 'expo-secure-store';

import type { DeviceIdRepository } from './device-id.repository';

const DEVICE_ID_KEY = 'aido_device_id';

// AFTER_FIRST_UNLOCK: 첫 잠금해제 후 접근 가능, 재설치해도 유지
const SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

export class DeviceIdRepositoryImpl implements DeviceIdRepository {
  async get(): Promise<string | null> {
    return SecureStore.getItemAsync(DEVICE_ID_KEY, SECURE_STORE_OPTIONS);
  }

  async save(deviceId: string): Promise<void> {
    await SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId, SECURE_STORE_OPTIONS);
  }

  async remove(): Promise<void> {
    await SecureStore.deleteItemAsync(DEVICE_ID_KEY, SECURE_STORE_OPTIONS);
  }
}
