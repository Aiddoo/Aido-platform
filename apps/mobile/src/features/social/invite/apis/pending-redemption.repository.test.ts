import { createMemorySyncStorage } from '@src/shared/__tests__';
import { toInstant } from '@src/shared/date/instant';

import { createPendingRedemption } from '../__tests__/invite.fixtures';
import { createPendingRedemptionRepository } from './pending-redemption.repository';

const PENDING_REDEMPTION_KEY = 'aido_invite_pending_v1';

describe('createPendingRedemptionRepository', () => {
  it('Date를 JSON으로 저장하던 옛 값을 순간으로 읽는다', () => {
    // Given
    const storage = createMemorySyncStorage();
    storage.set(
      PENDING_REDEMPTION_KEY,
      JSON.stringify({
        inviteCode: 'K7M2QX',
        source: 'universal_link',
        savedAt: new Date('2026-10-20T00:00:00Z'),
      }),
    );
    const repository = createPendingRedemptionRepository(storage);

    // When
    const result = repository.get();

    // Then
    expect(result).toEqual({
      inviteCode: 'K7M2QX',
      source: 'universal_link',
      savedAt: toInstant('2026-10-20T00:00:00.000Z'),
    });
  });

  it('저장한 값은 옛 형식과 같은 ISO 문자열로 남는다', () => {
    // Given
    const storage = createMemorySyncStorage();
    const repository = createPendingRedemptionRepository(storage);

    // When
    repository.save(createPendingRedemption({ savedAt: toInstant('2026-10-20T00:00:00.000Z') }));

    // Then
    expect(JSON.parse(storage.get(PENDING_REDEMPTION_KEY) ?? '{}')).toMatchObject({
      savedAt: '2026-10-20T00:00:00.000Z',
    });
  });

  it('손상된 값은 초대가 없는 것으로 읽는다', () => {
    // Given
    const storage = createMemorySyncStorage();
    storage.set(PENDING_REDEMPTION_KEY, '{broken');

    // When
    const result = createPendingRedemptionRepository(storage).get();

    // Then
    expect(result).toBeNull();
  });
});
