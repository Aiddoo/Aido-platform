import { aiReportResponseSchema, reportStatusResponseSchema } from '@aido/api';

import { reportStatusSchema } from '../domains/report-status.model';
import { aiReportSchema } from '../domains/report.model';
import { toAiReport, toReportStatus } from './report.mapper';

const reportDto = aiReportResponseSchema.parse({
  report: {
    id: 7,
    type: 'MONTHLY',
    year: 2026,
    period: 3,
    periodLabel: '3월',
    dateRange: { startDate: '2026-03-01', endDate: '2026-03-31' },
    stats: {
      totalTodos: 40,
      completedTodos: 30,
      completionRate: 75,
      prevCompletionRate: null,
      streakDays: 4,
    },
    categoryBreakdown: [{ name: '업무', color: '#FF6B6B', total: 10, completed: 8, rate: 80 }],
    dayPatterns: [{ day: 'MON', total: 6, completed: 5, rate: 83 }],
    timePatterns: [{ hour: 9, count: 5 }],
    aiSummary: '꾸준했어요',
    aiTips: ['아침에 몰아 하세요'],
    hasActivity: true,
    generatedAt: '2026-04-01T00:00:00.000Z',
  },
}).report;

describe('toAiReport', () => {
  it('계약 응답을 앱의 리포트 모델로 바꾼다', () => {
    // When
    const report = toAiReport(reportDto);

    // Then
    expect(aiReportSchema.parse(report)).toEqual(report);
    expect(report).toMatchObject({
      type: 'MONTHLY',
      generatedAt: '2026-04-01T00:00:00.000Z',
      dayPatterns: [{ day: 'MON', rate: 83 }],
    });
  });
});

describe('toReportStatus', () => {
  it('다음 리포트까지 남은 날짜만 앱 모델로 옮긴다', () => {
    // Given
    const { status } = reportStatusResponseSchema.parse({
      status: {
        nextWeeklyAt: '2026-03-09T00:00:00.000Z',
        nextMonthlyAt: '2026-04-01T00:00:00.000Z',
        daysUntilWeekly: 2,
        daysUntilMonthly: 23,
        latestWeekly: null,
        latestMonthly: reportDto,
      },
    });

    // When
    const reportStatus = toReportStatus(status);

    // Then
    expect(reportStatusSchema.parse(reportStatus)).toEqual(reportStatus);
    expect(reportStatus).toEqual({ daysUntilWeekly: 2, daysUntilMonthly: 23 });
  });
});
