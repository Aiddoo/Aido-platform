import type { DeviceIdStore } from '@src/core/ports/device-id-store';
import { DEVICE_SECURE_STORAGE_KEYS } from '@src/shared/storage/secure-storage-keys';
import * as SecureStore from 'expo-secure-store';

import { SECURE_STORE_OPTIONS } from './secure-store-options';

const DEVICE_ID_KEY = DEVICE_SECURE_STORAGE_KEYS.DEVICE_ID;

export const secureDeviceIdStore: DeviceIdStore = {
  get: () => SecureStore.getItemAsync(DEVICE_ID_KEY, SECURE_STORE_OPTIONS),
  save: (deviceId) => SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId, SECURE_STORE_OPTIONS),
  clear: () => SecureStore.deleteItemAsync(DEVICE_ID_KEY, SECURE_STORE_OPTIONS),
};
