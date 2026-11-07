import type { SyncStorage } from '@src/core/ports/sync-storage';

import { type DeviceTimezone, savedDeviceTimezoneSchema } from '../schemas/device-timezone.schema';

const DEVICE_TIMEZONE_KEY = 'aido_device_timezone_v1';

export interface DeviceTimezoneRepository {
  find(userId: string): DeviceTimezone | null;
  save(userId: string, deviceTimezone: DeviceTimezone): void;
  clear(): void;
}

/** 이 기기에서 쓰는 계정 하나의 값만 남긴다. 다른 계정의 값은 없는 것으로 읽는다 */
export function createDeviceTimezoneRepository(storage: SyncStorage): DeviceTimezoneRepository {
  return {
    find: (userId) => {
      const saved = storage.get(DEVICE_TIMEZONE_KEY);
      if (saved == null) {
        return null;
      }
      try {
        const parsed = savedDeviceTimezoneSchema.safeParse(JSON.parse(saved));
        return parsed.success && parsed.data.userId === userId ? parsed.data.deviceTimezone : null;
      } catch {
        return null;
      }
    },
    save: (userId, deviceTimezone) =>
      storage.set(DEVICE_TIMEZONE_KEY, JSON.stringify({ userId, deviceTimezone })),
    clear: () => storage.remove(DEVICE_TIMEZONE_KEY),
  };
}
