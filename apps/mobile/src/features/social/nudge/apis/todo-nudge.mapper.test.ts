import { setupFakeTimersPerTest } from '@src/shared/__tests__/setup-fake-timers-per-test';

import {
  createNudgeCooldownInfoDto,
  createNudgeLimitInfoDto,
} from '../__tests__/todo-nudge.fixtures';
import { toNudgeCooldownInfo, toNudgeLimitInfo } from './todo-nudge.mapper';

setupFakeTimersPerTest({ now: new Date('2026-03-08T00:00:00.000Z') });

describe('toNudgeLimitInfo', () => {
  it('필드 매핑', () => {
    // Given
    const dto = createNudgeLimitInfoDto();

    // When
    const result = toNudgeLimitInfo(dto);

    // Then
    expect(result).toEqual({
      dailyLimit: 5,
      usedToday: 2,
      remainingToday: 3,
      isUnlimited: false,
    });
  });
});

describe('toNudgeCooldownInfo', () => {
  it('cooldownEndsAt ISO 문자열을 Instant로 바꾼다', () => {
    // Given
    const dto = createNudgeCooldownInfoDto({
      canNudge: false,
      cooldownEndsAt: '2026-03-08T10:00:00.000Z',
      remainingSeconds: 300,
    });

    // When
    const result = toNudgeCooldownInfo(dto);

    // Then
    expect(result.canNudge).toBe(false);
    expect(result.cooldownEndsAt).toBe('2026-03-08T10:00:00.000Z');
    expect(result.remainingSeconds).toBe(300);
  });

  it('cooldownEndsAt이 null이면 null이다', () => {
    // Given
    const dto = createNudgeCooldownInfoDto();

    // When
    const result = toNudgeCooldownInfo(dto);

    // Then
    expect(result.cooldownEndsAt).toBeNull();
    expect(result.remainingSeconds).toBeNull();
  });
});
