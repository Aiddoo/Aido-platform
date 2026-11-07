import type { DeviceIdStore } from '@src/core/ports/device-id-store';
import * as SecureStore from 'expo-secure-store';

const DEVICE_ID_KEY = 'aido_device_id';

// AFTER_FIRST_UNLOCK: 첫 잠금해제 후 접근 가능, 재설치해도 유지
const SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
};

export const secureDeviceIdStore: DeviceIdStore = {
  get: () => SecureStore.getItemAsync(DEVICE_ID_KEY, SECURE_STORE_OPTIONS),
  save: (deviceId) => SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId, SECURE_STORE_OPTIONS),
  remove: () => SecureStore.deleteItemAsync(DEVICE_ID_KEY, SECURE_STORE_OPTIONS),
};
