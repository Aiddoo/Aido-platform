import { createUser } from '@src/features/identity/user/__tests__/user.fixtures';
import { toInstant } from '@src/shared/date/instant';

import { InviteeUserPolicy } from './invitee-user.model';

describe('isRewardExpected', () => {
  it('가입한 지 7일이 안 됐으면 true를 반환한다', () => {
    // Given
    const user = createUser({ createdAt: toInstant('2026-10-19T00:00:01Z') });
    const now = toInstant('2026-10-26T00:00:00Z');

    // When
    const result = InviteeUserPolicy.isRewardExpected(user, now);

    // Then
    expect(result).toBe(true);
  });

  it('가입한 지 정확히 7일이 지났으면 false를 반환한다', () => {
    // Given
    const user = createUser({ createdAt: toInstant('2026-10-19T00:00:00Z') });
    const now = toInstant('2026-10-26T00:00:00Z');

    // When
    const result = InviteeUserPolicy.isRewardExpected(user, now);

    // Then
    // 7일 = 7 × 24시간, 기간 안이 아니다
    expect(result).toBe(false);
  });
});
