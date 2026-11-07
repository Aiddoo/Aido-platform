import type { DeviceIdStore } from '@src/core/ports/device-id-store';

import { DeviceIdService } from './device-id.service';

function createDeviceIdStoreStub(initial: string | null = null): jest.Mocked<DeviceIdStore> {
  let stored = initial;
  return {
    get: jest.fn(async () => stored),
    save: jest.fn(async (deviceId: string) => {
      stored = deviceId;
    }),
    remove: jest.fn(async () => {
      stored = null;
    }),
  };
}

describe('DeviceIdService', () => {
  const originalPlatform = process.env.EXPO_OS;

  beforeEach(() => {
    process.env.EXPO_OS = 'ios';
  });

  afterEach(() => {
    process.env.EXPO_OS = originalPlatform;
  });

  it('저장된 기기 id가 있으면 그대로 돌려주고 새로 만들지 않는다', async () => {
    // Given
    const store = createDeviceIdStoreStub('ios_saved');
    const service = new DeviceIdService(
      store,
      { get: async () => 'vendor' },
      { create: () => 'uuid' },
    );

    // When
    const deviceId = await service.get();

    // Then
    expect(deviceId).toBe('ios_saved');
    expect(store.save).not.toHaveBeenCalled();
  });

  it('저장된 id가 없으면 플랫폼 식별자로 만들어 저장한다', async () => {
    // Given
    const store = createDeviceIdStoreStub();
    const service = new DeviceIdService(
      store,
      { get: async () => 'vendor' },
      { create: () => 'uuid' },
    );

    // When
    const deviceId = await service.get();

    // Then
    expect(deviceId).toBe('ios_vendor');
    expect(store.save).toHaveBeenCalledWith('ios_vendor');
  });

  it('플랫폼 식별자를 읽을 수 없으면 임의 UUID로 대신한다', async () => {
    // Given
    const store = createDeviceIdStoreStub();
    const service = new DeviceIdService(store, { get: async () => null }, { create: () => 'uuid' });

    // When
    const deviceId = await service.get();

    // Then
    expect(deviceId).toBe('ios_uuid');
  });

  it('지우면 다음 조회에서 다시 만든다', async () => {
    // Given
    const store = createDeviceIdStoreStub('ios_saved');
    const service = new DeviceIdService(
      store,
      { get: async () => 'vendor' },
      { create: () => 'uuid' },
    );

    // When
    await service.clear();
    const deviceId = await service.get();

    // Then
    expect(deviceId).toBe('ios_vendor');
  });
});
