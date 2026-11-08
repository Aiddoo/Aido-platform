import type { SyncStorage } from '@src/core/ports/sync-storage';
import { parseStoredJson } from '@src/shared/utils/parse-stored-json';

import { type DeviceTimezone } from '../domains/device-timezone.model';
import { savedDeviceTimezoneSchema } from '../schemas/device-timezone.schema';

const DEVICE_TIMEZONE_KEY = 'aido_device_timezone_v1';

export interface DeviceTimezoneRepository {
  find(userId: string): DeviceTimezone | null;
  save(userId: string, deviceTimezone: DeviceTimezone): void;
  clear(): void;
}

export function createDeviceTimezoneRepository(storage: SyncStorage): DeviceTimezoneRepository {
  return {
    find: (userId) => {
      const saved = parseStoredJson(storage.get(DEVICE_TIMEZONE_KEY), savedDeviceTimezoneSchema);
      return saved?.userId === userId ? saved.deviceTimezone : null;
    },
    save: (userId, deviceTimezone) => {
      try {
        storage.set(DEVICE_TIMEZONE_KEY, JSON.stringify({ userId, deviceTimezone }));
      } catch {
        // 저장하지 못하면 시간대 안내가 한 번 더 보일 뿐이다.
      }
    },
    clear: () => storage.remove(DEVICE_TIMEZONE_KEY),
  };
}
