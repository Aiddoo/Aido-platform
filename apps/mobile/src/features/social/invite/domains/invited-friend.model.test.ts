import { toInstant } from '@src/shared/date/instant';
import { orderBy } from 'es-toolkit';

import { createInvitedFriend, createInvitedFriendDto } from '../__tests__/invite.fixtures';
import { InvitedFriendSchema } from '../schemas/invited-friend.schema';
import {
  calculateActiveDaysLeft,
  InvitedFriendPolicy,
  orderByJoinedAtDesc,
  orderByWaitingFirst,
} from './invited-friend.model';

describe('orderByJoinedAtDesc', () => {
  it('나중에 가입한 친구가 앞에 오도록 정렬 값을 반환한다', () => {
    // Given
    const earlier = createInvitedFriend({
      userId: 'earlier',
      joinedAt: toInstant('2026-11-01T00:00:00Z'),
    });
    const later = createInvitedFriend({
      userId: 'later',
      joinedAt: toInstant('2026-11-03T00:00:00Z'),
    });

    // When
    const result = orderBy([earlier, later], [orderByJoinedAtDesc], ['asc']);

    // Then
    expect(result.map((friend) => friend.userId)).toEqual(['later', 'earlier']);
  });
});

describe('calculateActiveDaysLeft', () => {
  it('필요한 날보다 적게 했으면 남은 날을 반환한다', () => {
    // When
    const result = calculateActiveDaysLeft(1, 2);

    // Then 2 - 1 = 1
    expect(result).toBe(1);
  });

  it('필요한 날을 넘겼으면 0을 반환한다', () => {
    // When
    const result = calculateActiveDaysLeft(3, 2);

    // Then max(2 - 3, 0) = 0
    expect(result).toBe(0);
  });
});

describe('InvitedFriendPolicy', () => {
  describe('activeDaysLeft', () => {
    it('사용 시작까지 남은 날을 규칙 값으로 계산해 반환한다', () => {
      // Given
      const friend = createInvitedFriend({ activeDayCount: 0 });

      // When
      const result = InvitedFriendPolicy.getActiveDaysLeft(friend);

      // Then MIN_ACTIVE_DAYS 2 - 0 = 2
      expect(result).toBe(2);
    });
  });

  describe('pawPrintState', () => {
    it.each([
      ['JOINED', 'waiting'],
      ['QUALIFIED', 'stamped'],
      ['REWARDED', 'stamped'],
      ['REJECTED', 'excluded'],
      ['UNKNOWN', 'unknown'],
    ] as const)('상태가 %s면 %s를 반환한다', (status, expected) => {
      // Given
      const friend = createInvitedFriend({ status });

      // When
      const result = InvitedFriendPolicy.getPawPrintState(friend);

      // Then
      expect(result).toBe(expected);
    });
  });
});

describe('orderByWaitingFirst', () => {
  it('기다리는 친구가 먼저, 같은 상태끼리는 최근 가입 순으로 정렬 값을 반환한다', () => {
    // Given
    const rewardedLater = createInvitedFriend({
      userId: 'rewarded-later',
      status: 'REWARDED',
      joinedAt: toInstant('2026-11-05T00:00:00Z'),
    });
    const waitingEarlier = createInvitedFriend({
      userId: 'waiting-earlier',
      status: 'JOINED',
      joinedAt: toInstant('2026-11-01T00:00:00Z'),
    });
    const waitingLater = createInvitedFriend({
      userId: 'waiting-later',
      status: 'JOINED',
      joinedAt: toInstant('2026-11-03T00:00:00Z'),
    });

    // When
    const result = orderBy(
      [rewardedLater, waitingEarlier, waitingLater],
      [orderByWaitingFirst, orderByJoinedAtDesc],
      ['asc', 'asc'],
    );

    // Then JOINED(0) → 그 외(1), 같은 값이면 -joinedAt 오름차순
    expect(result.map((friend) => friend.userId)).toEqual([
      'waiting-later',
      'waiting-earlier',
      'rewarded-later',
    ]);
  });
});

describe('InvitedFriendSchema', () => {
  it('모르는 상태와 보상 제외 사유는 UNKNOWN과 null로 받는다', () => {
    // Given
    const dto = { ...createInvitedFriendDto(), status: 'PAUSED', rejectionReason: 'NEW_REASON' };

    // When
    const result = InvitedFriendSchema.parse(dto);

    // Then
    expect(result).toMatchObject({ status: 'UNKNOWN', rejectionReason: null });
  });
});
