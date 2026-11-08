import { createInvite } from '../__tests__/invite.fixtures';
import { InvitePolicy } from './invite.model';

describe('isOneTimeMilestone', () => {
  it('반복 간격이 없는 단계면 true를 반환한다', () => {
    // Given
    const milestone = { repeatEvery: null };

    // When
    const result = InvitePolicy.isOneTimeMilestone(milestone);

    // Then
    expect(result).toBe(true);
  });

  it('반복 간격이 있는 단계면 false를 반환한다', () => {
    // Given
    const milestone = { repeatEvery: 1 };

    // When
    const result = InvitePolicy.isOneTimeMilestone(milestone);

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
