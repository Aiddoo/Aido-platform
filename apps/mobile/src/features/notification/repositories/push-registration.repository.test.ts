import { toInstant } from '@src/shared/date/instant';
import { createMemoryKeyValueStorage } from '@src/testing/fakes/memory-key-value-storage.fake';

import { createPushRegistrationRepository } from './push-registration.repository';

/** 1.15.1이 키체인 `pushRegistration`에 남긴 원문. 뒤에 더한 칸이 있어도 앞 칸만 읽는다 */
const RELEASED_RAW = {
  reportedToken: 'ExponentPushToken[released]',
  releaseRequestedAt: '2026-11-01T00:00:00.000Z',
};

describe('createPushRegistrationRepository', () => {
  it('출시 앱이 남긴 원문을 그대로 읽는다', async () => {
    // Given
    const storage = createMemoryKeyValueStorage();
    await storage.set('pushRegistration', { ...RELEASED_RAW, unknownField: true });
    const repository = createPushRegistrationRepository(storage);

    // When
    const registration = await repository.find();

    // Then
    expect(registration).toEqual({
      reportedToken: 'ExponentPushToken[released]',
      releaseRequestedAt: toInstant('2026-11-01T00:00:00.000Z'),
    });
  });

  it('저장하면 출시 앱이 읽는 같은 키·모양으로 쓴다', async () => {
    // Given
    const storage = createMemoryKeyValueStorage();
    const repository = createPushRegistrationRepository(storage);

    // When
    await repository.save({ reportedToken: 'ExponentPushToken[new]', releaseRequestedAt: null });

    // Then
    expect(storage.set).toHaveBeenLastCalledWith('pushRegistration', {
      reportedToken: 'ExponentPushToken[new]',
      releaseRequestedAt: null,
    });
  });

  it.each([
    { name: '없는 값', raw: undefined },
    { name: '깨진 값', raw: { reportedToken: 7 } },
  ])('$name이면 보고한 적 없는 빈 등록이다', async ({ raw }) => {
    // Given
    const storage = createMemoryKeyValueStorage();
    if (raw != null) {
      await storage.set('pushRegistration', raw);
    }
    const repository = createPushRegistrationRepository(storage);

    // When
    const registration = await repository.find();

    // Then
    expect(registration).toEqual({ reportedToken: null, releaseRequestedAt: null });
  });
});
