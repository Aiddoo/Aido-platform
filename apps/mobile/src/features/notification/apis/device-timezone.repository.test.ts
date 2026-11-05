import { createMemorySyncStorage } from '@src/shared/__tests__';

import { createDeviceTimezoneRepository } from './device-timezone.repository';

const SEOUL = { timeZone: 'Asia/Seoul', offsetMinutes: 540 };

describe('createDeviceTimezoneRepository', () => {
  it('저장한 계정에게만 값을 돌려준다', () => {
    // Given
    const repository = createDeviceTimezoneRepository(createMemorySyncStorage());
    repository.save('user-a', SEOUL);

    // When
    const mine = repository.get('user-a');
    const other = repository.get('user-b');

    // Then
    expect(mine).toEqual(SEOUL);
    expect(other).toBeNull();
  });

  it('저장값이 깨졌으면 없는 것으로 읽는다', () => {
    // Given
    const storage = createMemorySyncStorage();
    storage.set('aido_device_timezone_v1', '{broken');
    const repository = createDeviceTimezoneRepository(storage);

    // When
    const result = repository.get('user-a');

    // Then
    expect(result).toBeNull();
  });

  it('지우면 어떤 계정에게도 남지 않는다', () => {
    // Given
    const repository = createDeviceTimezoneRepository(createMemorySyncStorage());
    repository.save('user-a', SEOUL);

    // When
    repository.clear();

    // Then
    expect(repository.get('user-a')).toBeNull();
  });
});
