import { aiReportResponseSchema, reportStatusResponseSchema } from '@aido/api/contracts/ai/v1';

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
      perfectDays: 1,
    },
    categoryBreakdown: [{ name: '업무', color: '#FF6B6B', total: 10, completed: 8, rate: 80 }],
    dayPatterns: [{ day: 'MON', total: 6, completed: 5, rate: 83 }],
    timePatterns: [{ hour: 9, count: 5 }],
    peakHour: 9,
    aiSummary: '꾸준했어요',
    aiTips: ['아침에 몰아 하세요'],
    hasActivity: true,
    generatedAt: '2026-04-01T00:00:00.000Z',
    dailyCompletions: [{ date: '2026-03-01', total: 2, completed: 1 }],
    aiContentSource: 'TEMPLATE',
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
      dailyCompletions: [{ date: '2026-03-01', total: 2, completed: 1 }],
      aiContentSource: 'TEMPLATE',
      stats: { perfectDays: 1 },
      peakHour: 9,
    });
  });

  it('날마다 기록이 없는 1.16.0 전 리포트는 완벽한 날·주로 끝낸 시간이 없는 리포트로 읽는다', () => {
    // Given
    const dto = { ...reportDto, stats: { ...reportDto.stats, perfectDays: null }, peakHour: null };

    // When
    const report = toAiReport(dto);

    // Then
    expect(report.stats.perfectDays).toBeNull();
    expect(report.peakHour).toBeNull();
  });
});

describe('toReportStatus', () => {
  it('다음 리포트 도착 순간만 앱 모델로 옮긴다. 남은 날은 앱이 기기 달력으로 센다', () => {
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
    expect(reportStatus).toEqual({
      nextWeeklyAt: '2026-03-09T00:00:00.000Z',
      nextMonthlyAt: '2026-04-01T00:00:00.000Z',
    });
  });
});
