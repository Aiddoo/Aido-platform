import { orderBy } from 'es-toolkit';

import { createInvitedFriend, createInvitedFriendDto } from '../__tests__/invite.factories';
import {
  calculateActiveDaysLeft,
  calculateHiddenCount,
  InvitedFriendPolicy,
  InvitedFriendSchema,
  orderByJoinedAtDesc,
  orderByWaitingFirst,
} from './invited-friend.model';

describe('orderByJoinedAtDesc', () => {
  it('나중에 가입한 친구가 앞에 오도록 정렬 값을 반환한다', () => {
    // Given
    const earlier = createInvitedFriend({
      userId: 'earlier',
      joinedAt: new Date('2026-11-01T00:00:00Z'),
    });
    const later = createInvitedFriend({
      userId: 'later',
      joinedAt: new Date('2026-11-03T00:00:00Z'),
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
      const result = InvitedFriendPolicy.activeDaysLeft(friend);

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
      const result = InvitedFriendPolicy.pawPrintState(friend);

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
      joinedAt: new Date('2026-11-05T00:00:00Z'),
    });
    const waitingEarlier = createInvitedFriend({
      userId: 'waiting-earlier',
      status: 'JOINED',
      joinedAt: new Date('2026-11-01T00:00:00Z'),
    });
    const waitingLater = createInvitedFriend({
      userId: 'waiting-later',
      status: 'JOINED',
      joinedAt: new Date('2026-11-03T00:00:00Z'),
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

describe('calculateHiddenCount', () => {
  it.each([
    [0, 5, 0],
    [5, 5, 0],
    [6, 5, 1],
    [100, 5, 95],
  ])('전체 %i명 중 %i명을 보여 주면 숨은 %i명을 반환한다', (totalCount, limit, expected) => {
    // When
    const result = calculateHiddenCount(totalCount, limit);

    // Then max(전체 - 보이는 수, 0)
    expect(result).toBe(expected);
  });
});

describe('InvitedFriendPolicy.summaryFriends', () => {
  it.each([
    [0, 0],
    [5, 5],
    [6, 5],
    [100, 5],
  ])('친구 %i명이면 앞에서 %i명을 반환한다', (count, expected) => {
    // Given
    const friends = Array.from({ length: count }, (_, index) =>
      createInvitedFriend({ userId: `friend-${index}` }),
    );

    // When
    const result = InvitedFriendPolicy.summaryFriends(friends);

    // Then min(친구 수, 5)
    expect(result).toHaveLength(expected);
    expect(result[0]?.userId).toBe(count > 0 ? 'friend-0' : undefined);
  });
});

describe('InvitedFriendPolicy.hasMoreThanSummary', () => {
  it.each([
    [0, false],
    [5, false],
    [6, true],
    [100, true],
  ])('전체 %i명이면 %s를 반환한다', (totalCount, expected) => {
    // When
    const result = InvitedFriendPolicy.hasMoreThanSummary(totalCount);

    // Then 전체 - 5 > 0
    expect(result).toBe(expected);
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
