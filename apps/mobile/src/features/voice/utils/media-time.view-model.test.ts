import { formatMediaTime } from './media-time.view-model';

describe('formatMediaTime', () => {
  it('1분 미만은 초를 두 자리로 맞춘다', () => {
    // Given
    const ms = 9_999;

    // When
    const text = formatMediaTime(ms);

    // Then
    expect(text).toBe('0:09');
  });

  it('한 시간부터는 시간을 붙인다', () => {
    // Given
    const ms = 3_725_000;

    // When
    const text = formatMediaTime(ms);

    // Then
    expect(text).toBe('1:02:05');
  });

  it('음수는 0으로 본다', () => {
    // Given
    const ms = -500;

    // When
    const text = formatMediaTime(ms);

    // Then
    expect(text).toBe('0:00');
  });
});
