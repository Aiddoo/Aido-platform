import type { DeviceIdStore } from '@src/core/ports/device-id-store';

/** 저장·삭제가 다음 읽기에 반영되는 기기 id 저장소. 처음 값은 `initial`로 정한다 */
export function createMemoryDeviceIdStore(
  initial: string | null = null,
): jest.Mocked<DeviceIdStore> {
  let stored = initial;

  return {
    get: jest.fn(async () => stored),
    save: jest.fn(async (deviceId: string) => {
      stored = deviceId;
    }),
    clear: jest.fn(async () => {
      stored = null;
    }),
  };
}
