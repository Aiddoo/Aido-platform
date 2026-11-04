import { formatClock } from './format-clock';

describe('formatClock', () => {
  it('초를 m:ss로 보여준다', () => {
    // When
    const results = [formatClock(4_900), formatClock(75_000), formatClock(-1)];

    // Then
    expect(results).toEqual(['0:04', '1:15', '0:00']);
  });
});
