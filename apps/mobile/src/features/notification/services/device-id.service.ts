import * as Application from 'expo-application';
import * as Crypto from 'expo-crypto';
import { Platform } from 'react-native';

import type { DeviceIdRepository } from '../repositories/device-id.repository';

interface DeviceIdComponents {
  iosId: string | null;
  androidId: string | null;
  installId: string;
}

export class DeviceIdService {
  constructor(private readonly _deviceIdRepository: DeviceIdRepository) {}

  get = async (): Promise<string> => {
    const storedId = await this._deviceIdRepository.get();
    if (storedId) {
      return storedId;
    }

    const components = await this._getDeviceComponents();
    const deviceId = this._generateDeviceId(components);
    await this._deviceIdRepository.save(deviceId);

    return deviceId;
  };

  clear = async (): Promise<void> => {
    await this._deviceIdRepository.remove();
  };

  private _getDeviceComponents = async (): Promise<DeviceIdComponents> => {
    const [iosId, androidId, installId] = await Promise.all([
      Platform.OS === 'ios' ? Application.getIosIdForVendorAsync() : Promise.resolve(null),
      Platform.OS === 'android'
        ? Promise.resolve(Application.getAndroidId())
        : Promise.resolve(null),
      Crypto.randomUUID(),
    ]);

    return { iosId, androidId, installId };
  };

  // 우선순위: iOS Vendor ID > Android ID > Random UUID
  private _generateDeviceId = (components: DeviceIdComponents): string => {
    const { iosId, androidId, installId } = components;
    const platformId = iosId ?? androidId ?? installId;

    return `${Platform.OS}_${platformId}`;
  };
}
