import { formatDegrees } from './format-degrees';

describe('formatDegrees', () => {
  it.each([
    [12, '12°'],
    [0, '0°'],
    [-3, '−3°'],
  ])('%s도를 %s로 보여 준다', (value, expected) => {
    // When
    const text = formatDegrees(value);

    // Then
    expect(text).toBe(expected);
  });
});
