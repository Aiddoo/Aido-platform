import { createInvite } from '../__tests__/invite.fixtures';
import { InvitePolicy, isOneTimeMilestone } from './invite.model';

describe('isOneTimeMilestone', () => {
  it('반복 간격이 없는 단계면 true를 반환한다', () => {
    // Given
    const milestone = { repeatEvery: null };

    // When
    const result = isOneTimeMilestone(milestone);

    // Then
    expect(result).toBe(true);
  });

  it('반복 간격이 있는 단계면 false를 반환한다', () => {
    // Given
    const milestone = { repeatEvery: 1 };

    // When
    const result = isOneTimeMilestone(milestone);

    // Then
    expect(result).toBe(false);
  });
});

describe('getRemainingToNextMilestone', () => {
  it('다음 단계가 없으면 null을 반환한다', () => {
    // Given
    const myInvite = createInvite({ nextMilestone: null });

    // When
    const result = InvitePolicy.getRemainingToNextMilestone(myInvite);

    // Then
    expect(result).toBeNull();
  });

  it('다음 단계까지 남은 인원을 반환한다', () => {
    // Given
    const myInvite = createInvite({
      qualifiedCount: 2,
      nextMilestone: { qualifiedCount: 3, rewards: [] },
    });

    // When
    const result = InvitePolicy.getRemainingToNextMilestone(myInvite);

    // Then
    // 3 - 2 = 1
    expect(result).toBe(1);
  });

  it('다음 단계 인원을 넘겼으면 0을 반환한다', () => {
    // Given
    const myInvite = createInvite({
      qualifiedCount: 4,
      nextMilestone: { qualifiedCount: 3, rewards: [] },
    });

    // When
    const result = InvitePolicy.getRemainingToNextMilestone(myInvite);

    // Then
    // max(3 - 4, 0) = 0
    expect(result).toBe(0);
  });
});

describe('getNextPremiumDays', () => {
  it('다음 단계 보상의 프리미엄 일수를 반환한다', () => {
    // Given
    const myInvite = createInvite();

    // When
    const result = InvitePolicy.getNextPremiumDays(myInvite);

    // Then
    expect(result).toBe(7);
  });

  it('다음 단계가 없으면 0을 반환한다', () => {
    // Given
    const myInvite = createInvite({ nextMilestone: null });

    // When
    const result = InvitePolicy.getNextPremiumDays(myInvite);

    // Then
    expect(result).toBe(0);
  });
});

describe('getProgress', () => {
  it('발자국이 없으면 not-started를 반환한다', () => {
    // Given
    const myInvite = createInvite({ qualifiedCount: 0, waitingCount: 1 });

    // When
    const result = InvitePolicy.getProgress(myInvite);

    // Then
    expect(result).toBe('not-started');
  });

  it('발자국이 있으면 in-progress를 반환한다', () => {
    // Given
    const myInvite = createInvite({ qualifiedCount: 1, premiumDaysInWindow: 7 });

    // When
    const result = InvitePolicy.getProgress(myInvite);

    // Then
    expect(result).toBe('in-progress');
  });

  it.each([
    ['WINDOW_REACHED', 'monthly-cap-reached'],
    ['TOTAL_REACHED', 'total-cap-reached'],
  ] as const)(
    '서버가 상한을 %s로 보내면 발자국·기다리는 친구 수와 관계없이 %s를 반환한다',
    (premiumCapState, expected) => {
      // Given
      // 기다리는 친구가 남아 있어도 상한 안내가 먼저다
      const myInvite = createInvite({ qualifiedCount: 5, waitingCount: 2, premiumCapState });

      // When
      const result = InvitePolicy.getProgress(myInvite);

      // Then
      expect(result).toBe(expected);
    },
  );

  it('받은 일수가 상한이어도 서버가 AVAILABLE로 보내면(30일 기간 해제) in-progress를 반환한다', () => {
    // Given
    // 앱은 받은 일수로 상한을 다시 계산하지 않는다
    const myInvite = createInvite({
      qualifiedCount: 5,
      premiumDaysInWindow: 30,
      premiumCapState: 'AVAILABLE',
    });

    // When
    const result = InvitePolicy.getProgress(myInvite);

    // Then
    expect(result).toBe('in-progress');
  });
});

describe('getNextFriendSlots', () => {
  it('다음 발자국에서 받는 친구 칸 수를 돌려준다', () => {
    // Given
    const invite = createInvite({
      nextMilestone: {
        qualifiedCount: 3,
        rewards: [
          { rewardType: 'PREMIUM_DAYS', quantity: 7 },
          { rewardType: 'FRIEND_SLOT', quantity: 2 },
        ],
      },
    });

    // When
    const slots = InvitePolicy.getNextFriendSlots(invite);

    // Then
    expect(slots).toBe(2);
  });

  it('다음 발자국이 없으면 0칸이다', () => {
    // Given
    const invite = createInvite({ nextMilestone: null });

    // When
    const slots = InvitePolicy.getNextFriendSlots(invite);

    // Then
    expect(slots).toBe(0);
  });
});

describe('getEarnedPremiumDays', () => {
  it('이미 받은 보상 중 프리미엄 일수를 더한다', () => {
    // Given
    const invite = createInvite({
      rewardsEarned: [
        { rewardType: 'PREMIUM_DAYS', quantity: 7 },
        { rewardType: 'FRIEND_SLOT', quantity: 1 },
        { rewardType: 'PREMIUM_DAYS', quantity: 7 },
      ],
    });

    // When
    const days = InvitePolicy.getEarnedPremiumDays(invite);

    // Then
    // 7 + 7 = 14
    expect(days).toBe(14);
  });

  it('받은 보상이 없으면 0일이다', () => {
    // Given
    const invite = createInvite({ rewardsEarned: [] });

    // When
    const days = InvitePolicy.getEarnedPremiumDays(invite);

    // Then
    expect(days).toBe(0);
  });
});

describe('getEarnedFriendSlots', () => {
  it('이미 받은 보상 중 친구 칸을 더한다', () => {
    // Given
    const invite = createInvite({
      rewardsEarned: [
        { rewardType: 'FRIEND_SLOT', quantity: 1 },
        { rewardType: 'PREMIUM_DAYS', quantity: 7 },
        { rewardType: 'FRIEND_SLOT', quantity: 1 },
      ],
    });

    // When
    const slots = InvitePolicy.getEarnedFriendSlots(invite);

    // Then
    // 1 + 1 = 2
    expect(slots).toBe(2);
  });

  it('받은 보상이 없으면 0칸이다', () => {
    // Given
    const invite = createInvite({ rewardsEarned: [] });

    // When
    const slots = InvitePolicy.getEarnedFriendSlots(invite);

    // Then
    expect(slots).toBe(0);
  });
});

describe('hasInvitedAnyone', () => {
  it.each([
    {
      title: '가입한 친구가 없으면 아직 초대하지 않았다',
      qualifiedCount: 0,
      waitingCount: 0,
      expected: false,
    },
    {
      title: '발자국을 기다리는 친구 한 명도 초대한 것이다',
      qualifiedCount: 0,
      waitingCount: 1,
      expected: true,
    },
    {
      title: '발자국을 찍은 친구 한 명도 초대한 것이다',
      qualifiedCount: 1,
      waitingCount: 0,
      expected: true,
    },
  ])('$title', ({ qualifiedCount, waitingCount, expected }) => {
    // Given
    const invite = createInvite({ qualifiedCount, waitingCount });

    // When
    const result = InvitePolicy.hasInvitedAnyone(invite);

    // Then
    expect(result).toBe(expected);
  });
});

describe('hasNewPawPrints', () => {
  it('지난번 축하한 수보다 사용을 시작한 친구가 늘었으면 true를 반환한다', () => {
    // Given
    // 3명 > 2명
    const invite = createInvite({ qualifiedCount: 3 });

    // When
    const result = InvitePolicy.hasNewPawPrints(invite, 2);

    // Then
    expect(result).toBe(true);
  });

  it('축하한 수와 같으면 false를 반환한다', () => {
    // Given
    const invite = createInvite({ qualifiedCount: 2 });

    // When
    const result = InvitePolicy.hasNewPawPrints(invite, 2);

    // Then
    expect(result).toBe(false);
  });

  it('보상에서 빠져 수가 줄었으면 false를 반환한다', () => {
    // Given
    // 1명 < 2명
    const invite = createInvite({ qualifiedCount: 1 });

    // When
    const result = InvitePolicy.hasNewPawPrints(invite, 2);

    // Then
    expect(result).toBe(false);
  });
});
