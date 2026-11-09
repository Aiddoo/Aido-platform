import { isClockTimeInRange } from './clock-time';

const MORNING = { minimumTime: { hour: 0, minute: 0 }, maximumTime: { hour: 11, minute: 59 } };

describe('isClockTimeInRange', () => {
  it('범위의 양 끝 시각은 안에 든다', () => {
    // Given
    // 오전 범위 00:00~11:59

    // When
    const first = isClockTimeInRange({ hour: 0, minute: 0 }, MORNING);
    const last = isClockTimeInRange({ hour: 11, minute: 59 }, MORNING);

    // Then
    expect([first, last]).toEqual([true, true]);
  });

  it('오후 시각은 오전 범위 밖이다', () => {
    // Given
    // 오전 범위 00:00~11:59

    // When
    const result = isClockTimeInRange({ hour: 12, minute: 0 }, MORNING);

    // Then
    expect(result).toBe(false);
  });
});
