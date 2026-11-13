import {
  createIdGeneratorStub,
  createMemoryDeviceIdStore,
  createVendorIdGatewayStub,
} from '@src/testing/core';

import { DeviceIdService } from './device-id.service';

function createService({
  savedId = null,
  vendorId = 'vendor',
}: { savedId?: string | null; vendorId?: string | null } = {}) {
  const store = createMemoryDeviceIdStore(savedId);
  const vendorIdGateway = createVendorIdGatewayStub();
  vendorIdGateway.get.mockResolvedValue(vendorId);
  const idGenerator = createIdGeneratorStub();
  const service = new DeviceIdService({
    store,
    vendorId: vendorIdGateway,
    idGenerator,
    platform: 'ios',
  });

  return { service, store, idGenerator };
}

describe('DeviceIdService', () => {
  it('저장된 기기 id가 있으면 그대로 돌려주고 새로 만들지 않는다', async () => {
    // Given
    const { service, store } = createService({ savedId: 'ios_saved' });

    // When
    const deviceId = await service.get();

    // Then
    expect(deviceId).toBe('ios_saved');
    expect(store.save).not.toHaveBeenCalled();
  });

  it('저장된 id가 없으면 플랫폼 식별자로 만들어 저장한다', async () => {
    // Given
    const { service, store } = createService();

    // When
    const deviceId = await service.get();

    // Then
    expect(deviceId).toBe('ios_vendor');
    expect(store.save).toHaveBeenCalledWith('ios_vendor');
  });

  it('플랫폼 식별자를 읽을 수 없으면 임의 id로 대신한다', async () => {
    // Given
    const { service, idGenerator } = createService({ vendorId: null });
    idGenerator.create.mockReturnValue('uuid');

    // When
    const deviceId = await service.get();

    // Then
    expect(deviceId).toBe('ios_uuid');
  });

  it('지우면 다음 조회에서 다시 만든다', async () => {
    // Given
    const { service } = createService({ savedId: 'ios_saved' });

    // When
    await service.clear();
    const deviceId = await service.get();

    // Then
    expect(deviceId).toBe('ios_vendor');
  });
});
