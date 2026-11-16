import '@src/shared/i18n/init';
import { createDateKey } from '@src/testing/date-key';
import { range, sumBy } from 'es-toolkit';

import { TREND_WEEK_COUNT } from '../constants/report-chart.constants';
import { SAMPLE_REPORT_COUNT } from '../constants/sample-report.constants';
import { ReportPolicy, type ReportType } from '../domains/report.model';
import { createSampleReport, getSampleTrendWeeks } from './sample-report.view-model';

const TODAY_KEY = createDateKey('2026-11-17');
const CONTEXT = { todayKey: TODAY_KEY, language: 'ko' };
const REPORT_TYPES: ReportType[] = ['WEEKLY', 'MONTHLY'];

describe('createSampleReport', () => {
  it('지난주 예시는 이번 주 바로 앞 월~일이고 끝낸 날이 이어진 만큼 연속이다', () => {
    // When
    const report = createSampleReport('WEEKLY', 1, CONTEXT);

    // Then
    expect(report.dateRange).toEqual({ startDate: '2026-11-09', endDate: '2026-11-15' });
    expect([report.year, report.period]).toEqual([2026, 46]);
    expect(report.stats).toEqual({
      totalTodos: 32,
      completedTodos: 25,
      completionRate: 78,
      prevCompletionRate: 66,
      streakDays: 3,
    });
    expect(ReportPolicy.getPerfectDayCount(report)).toBe(3);
  });

  it('월간 예시는 지난달 1일부터 말일까지 날마다 기록이 있고 달 끝 5일을 모두 끝냈다', () => {
    // When
    const report = createSampleReport('MONTHLY', 1, {
      todayKey: createDateKey('2028-03-10'),
      language: 'ko',
    });

    // Then
    expect(report.dateRange).toEqual({ startDate: '2028-02-01', endDate: '2028-02-29' });
    expect([report.year, report.period]).toEqual([2028, 2]);
    expect(report.dailyCompletions).toHaveLength(29);
    expect(report.stats.streakDays).toBeGreaterThanOrEqual(5);
  });

  it('연초의 지난주 예시는 지난해 마지막 ISO 주다', () => {
    // When
    const report = createSampleReport('WEEKLY', 1, {
      todayKey: createDateKey('2027-01-05'),
      language: 'ko',
    });

    // Then
    expect(report.dateRange).toEqual({ startDate: '2026-12-28', endDate: '2027-01-03' });
    expect([report.year, report.period]).toEqual([2026, 53]);
  });

  it.each(REPORT_TYPES)('%s 예시마다 통계·카테고리·시간대가 날마다 기록의 합과 같다', (type) => {
    // When
    const reports = range(1, SAMPLE_REPORT_COUNT + 1).map((periodsAgo) =>
      createSampleReport(type, periodsAgo, CONTEXT),
    );

    // Then
    for (const { stats, dailyCompletions, categoryBreakdown, timePatterns } of reports) {
      const days = dailyCompletions ?? [];
      expect(sumBy(days, (day) => day.total)).toBe(stats.totalTodos);
      expect(sumBy(days, (day) => day.completed)).toBe(stats.completedTodos);
      expect(days.every((day) => 0 <= day.completed && day.completed <= day.total)).toBe(true);
      expect(sumBy(categoryBreakdown, (category) => category.total)).toBe(stats.totalTodos);
      expect(sumBy(categoryBreakdown, (category) => category.completed)).toBe(stats.completedTodos);
      expect(sumBy(timePatterns, (pattern) => pattern.count)).toBe(stats.completedTodos);
    }
  });

  it.each(REPORT_TYPES)('%s 예시의 지난번 비교는 한 기간 앞 예시의 달성률이다', (type) => {
    // When
    const reports = range(1, SAMPLE_REPORT_COUNT + 1).map((periodsAgo) =>
      createSampleReport(type, periodsAgo, CONTEXT),
    );

    // Then
    expect(reports.slice(0, -1).map((report) => report.stats.prevCompletionRate)).toEqual(
      reports.slice(1).map((report) => report.stats.completionRate),
    );
  });

  it('코치 글과 카테고리 이름은 넘긴 언어로 만든다', () => {
    // When
    const ko = createSampleReport('WEEKLY', 1, CONTEXT);
    const en = createSampleReport('WEEKLY', 1, { todayKey: TODAY_KEY, language: 'en' });

    // Then
    expect(ko.categoryBreakdown.map((category) => category.name)).toEqual(['업무', '공부', '운동']);
    expect(en.categoryBreakdown.map((category) => category.name)).toEqual([
      'Work',
      'Study',
      'Workout',
    ]);
    expect(en.aiSummary).not.toBe(ko.aiSummary);
  });
});

describe('getSampleTrendWeeks', () => {
  it('오래된 주부터 8주이고 마지막 주가 지난주 예시의 달성률이다', () => {
    // When
    const weeks = getSampleTrendWeeks(TODAY_KEY);

    // Then
    expect(weeks).toHaveLength(TREND_WEEK_COUNT);
    expect(weeks[0]?.startDate).toBe('2026-09-21');
    expect(weeks.at(-1)).toEqual({
      startDate: '2026-11-09',
      completionRate: createSampleReport('WEEKLY', 1, CONTEXT).stats.completionRate,
    });
  });
});
