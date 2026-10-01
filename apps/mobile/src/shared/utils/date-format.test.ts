import { formatClockTime, formatDateLabel } from './date-format';

const date = new Date('2026-10-01T00:05:00Z');

describe('native date formatting', () => {
  it('uses the explicit locale and time zone', () => {
    expect(formatDateLabel(date, 'fullDate', { locale: 'ko-KR', timeZone: 'Asia/Seoul' })).toBe(
      '2026년 10월 1일',
    );
    expect(
      formatDateLabel(date, 'fullDate', { locale: 'en-US', timeZone: 'America/Los_Angeles' }),
    ).toBe('September 30, 2026');
  });

  it('preserves the input time convention and never displays midnight as 24:00', () => {
    expect(formatClockTime(date, 'TWENTY_FOUR_HOUR', { locale: 'en-US', timeZone: 'UTC' })).toBe(
      '00:05',
    );
    expect(formatClockTime(date, 'TWELVE_HOUR', { locale: 'ko-KR', timeZone: 'Asia/Seoul' })).toBe(
      '오전 9:05',
    );
  });

  it('rejects invalid dates without throwing during rendering', () => {
    expect(
      formatDateLabel(new Date('invalid'), 'fullDate', { locale: 'ko-KR', timeZone: 'UTC' }),
    ).toBe('');
  });
});
