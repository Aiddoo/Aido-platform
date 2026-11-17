import { toInstant } from '@src/shared/date/instant';

import { type ReportStatus, ReportStatusPolicy } from './report-status.model';

// 서울 월요일 11-23 06:00에 주간, 12-01 06:00에 월간 리포트가 온다
const STATUS: ReportStatus = {
  nextWeeklyAt: toInstant('2026-11-22T21:00:00.000Z'),
  nextMonthlyAt: toInstant('2026-11-30T21:00:00.000Z'),
};
const SEOUL = 'Asia/Seoul';

describe('getDaysUntilReport', () => {
  it.each([
    { now: '2026-11-21T14:59:00.000Z', expected: 2, label: '토 23:59' },
    { now: '2026-11-21T15:00:00.000Z', expected: 1, label: '일 00:00' },
    { now: '2026-11-22T15:00:00.000Z', expected: 0, label: '월 00:00' },
  ])('서울 $label에 주간 리포트는 D-$expected다', ({ now, expected }) => {
    // When
    const daysLeft = ReportStatusPolicy.getDaysUntilReport(STATUS, 'WEEKLY', {
      now: toInstant(now),
      timeZone: SEOUL,
    });

    // Then
    expect(daysLeft).toBe(expected);
  });

  it('같은 응답을 들고 화면을 켜 둔 채 자정을 넘기면 남은 날이 하루 줄어든다', () => {
    // When
    const beforeMidnight = ReportStatusPolicy.getDaysUntilReport(STATUS, 'MONTHLY', {
      now: toInstant('2026-11-25T14:59:00.000Z'),
      timeZone: SEOUL,
    });
    const afterMidnight = ReportStatusPolicy.getDaysUntilReport(STATUS, 'MONTHLY', {
      now: toInstant('2026-11-25T15:00:00.000Z'),
      timeZone: SEOUL,
    });

    // Then
    expect([beforeMidnight, afterMidnight]).toEqual([6, 5]);
  });
});
