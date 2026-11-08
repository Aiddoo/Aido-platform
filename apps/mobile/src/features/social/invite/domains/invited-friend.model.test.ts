import { toInstant } from '@src/shared/date/instant';
import { orderBy } from 'es-toolkit';

import { createInvitedFriend } from '../__tests__/invite.fixtures';
import { InvitedFriendPolicy } from './invited-friend.model';

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
    const result = orderBy([earlier, later], [InvitedFriendPolicy.orderByJoinedAtDesc], ['asc']);

    // Then
    expect(result.map((friend) => friend.userId)).toEqual(['later', 'earlier']);
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
      [InvitedFriendPolicy.orderByWaitingFirst, InvitedFriendPolicy.orderByJoinedAtDesc],
      ['asc', 'asc'],
    );

    // Then
    // JOINED(0) → 그 외(1), 같은 값이면 -joinedAt 오름차순
    expect(result.map((friend) => friend.userId)).toEqual([
      'waiting-later',
      'waiting-earlier',
      'rewarded-later',
    ]);
  });
});

describe('getActiveDaysLeft', () => {
  it('사용 시작까지 남은 날을 규칙 값으로 계산해 반환한다', () => {
    // Given
    const friend = createInvitedFriend({ activeDayCount: 0 });

    // When
    const result = InvitedFriendPolicy.getActiveDaysLeft(friend);

    // Then
    // MIN_ACTIVE_DAYS 2 - 0 = 2
    expect(result).toBe(2);
  });

  it('필요한 날을 넘겨 썼으면 0을 반환한다', () => {
    // Given
    const friend = createInvitedFriend({ activeDayCount: 3 });

    // When
    const result = InvitedFriendPolicy.getActiveDaysLeft(friend);

    // Then
    // max(2 - 3, 0) = 0
    expect(result).toBe(0);
  });
});

describe('getPawPrintState', () => {
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

describe('hasStartedActiveDays', () => {
  it.each([
    { activeDayCount: 0, expected: false },
    { activeDayCount: 1, expected: true },
    { activeDayCount: 3, expected: true },
  ])(
    '활동한 날이 $activeDayCount일이면 시작했는지는 $expected다',
    ({ activeDayCount, expected }) => {
      // Given
      const friend = createInvitedFriend({ activeDayCount });

      // When
      const result = InvitedFriendPolicy.hasStartedActiveDays(friend);

      // Then
      expect(result).toBe(expected);
    },
  );
});
