import type { DeviceIdStore } from '@src/core/ports/device-id-store';
import * as SecureStore from 'expo-secure-store';

import { SECURE_STORE_OPTIONS } from './secure-store-options';

// oxlint-disable-next-line aido/storage-key-location -- 1.15.2 전환 #1400
const DEVICE_ID_KEY = 'aido_device_id';

export const secureDeviceIdStore: DeviceIdStore = {
  get: () => SecureStore.getItemAsync(DEVICE_ID_KEY, SECURE_STORE_OPTIONS),
  save: (deviceId) => SecureStore.setItemAsync(DEVICE_ID_KEY, deviceId, SECURE_STORE_OPTIONS),
  clear: () => SecureStore.deleteItemAsync(DEVICE_ID_KEY, SECURE_STORE_OPTIONS),
};
