import {
  createNudgeCooldownInfoDto,
  createNudgeLimitInfoDto,
  createSendNudgeResponseDto,
} from '../__tests__/todo-nudge.factories';
import { toNudgeCooldownInfo, toNudgeLimitInfo, toSendNudgeResult } from './todo-nudge.mapper';

jest.useFakeTimers({ now: new Date('2026-03-08T00:00:00.000Z') });

describe('toNudgeLimitInfo', () => {
  test('필드 매핑', () => {
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
  test('cooldownEndsAt ISO → Date 변환', () => {
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
    expect(result.cooldownEndsAt).toBeInstanceOf(Date);
    expect(result.cooldownEndsAt?.toISOString()).toBe('2026-03-08T10:00:00.000Z');
    expect(result.remainingSeconds).toBe(300);
  });

  test('cooldownEndsAt null → null', () => {
    // Given
    const dto = createNudgeCooldownInfoDto();

    // When
    const result = toNudgeCooldownInfo(dto);

    // Then
    expect(result.cooldownEndsAt).toBeNull();
    expect(result.remainingSeconds).toBeNull();
  });
});

describe('toSendNudgeResult', () => {
  test('message 매핑', () => {
    // Given
    const dto = createSendNudgeResponseDto({ message: '콕!' });

    // When
    const result = toSendNudgeResult(dto);

    // Then
    expect(result.message).toBe('콕!');
  });
});
