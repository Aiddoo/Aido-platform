import {
  createNudgeCooldownInfoDto,
  createNudgeLimitInfoDto,
  createSendNudgeResponseDto,
} from '../__tests__/todo-nudge.fixtures';
import { toNudgeCooldownInfo, toNudgeLimitInfo, toSendNudgeResult } from './todo-nudge.mapper';

beforeEach(() => {
  jest.useFakeTimers({ now: new Date('2026-03-08T00:00:00.000Z') });
});

afterEach(() => {
  jest.useRealTimers();
});

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

describe('toSendNudgeResult', () => {
  it('message 매핑', () => {
    // Given
    const dto = createSendNudgeResponseDto({ message: '콕!' });

    // When
    const result = toSendNudgeResult(dto);

    // Then
    expect(result.message).toBe('콕!');
  });
});
