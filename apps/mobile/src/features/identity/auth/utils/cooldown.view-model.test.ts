import { getRemainingCooldownSeconds } from './cooldown.view-model';

const DEADLINE_MS = 1_700_000_060_000;

describe('getRemainingCooldownSeconds', () => {
  it.each([
    ['마감 60초 전', DEADLINE_MS - 60_000, 60],
    ['마감 0.2초 전', DEADLINE_MS - 200, 1],
    ['마감 순간', DEADLINE_MS, 0],
    ['마감 뒤', DEADLINE_MS + 5_000, 0],
  ])('%s에는 %i초가 남는다', (_label, nowMs, expected) => {
    // Given
    const deadlineMs = DEADLINE_MS;

    // When
    const remaining = getRemainingCooldownSeconds(deadlineMs, nowMs);

    // Then
    expect(remaining).toBe(expected);
  });

  it('백그라운드에서 타이머가 멈춰 있었어도 돌아온 시각 기준으로 남은 초를 센다', () => {
    // Given
    const startedAtMs = DEADLINE_MS - 60_000;
    const returnedAtMs = startedAtMs + 45_000;

    // When
    const remaining = getRemainingCooldownSeconds(DEADLINE_MS, returnedAtMs);

    // Then
    expect(remaining).toBe(15);
  });

  it('시작하지 않았으면 0초다', () => {
    // Given
    const deadlineMs = null;

    // When
    const remaining = getRemainingCooldownSeconds(deadlineMs, DEADLINE_MS);

    // Then
    expect(remaining).toBe(0);
  });
});
