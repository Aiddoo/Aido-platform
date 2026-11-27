import { aiReportSchema as aiReportDtoSchema, reportStatusSchema } from '@aido/api/contracts/ai/v1';
import { defineFixture } from '@src/testing/fixture';

import { aiReportSchema } from '../domains/report.model';

export const createAiReport = defineFixture(aiReportSchema, {
  id: 1,
  type: 'WEEKLY',
  year: 2026,
  period: 10,
  dateRange: { startDate: '2026-03-02', endDate: '2026-03-08' },
  stats: {
    totalTodos: 10,
    completedTodos: 6,
    completionRate: 60,
    prevCompletionRate: 75,
    streakDays: 3,
    perfectDays: null,
  },
  categoryBreakdown: [],
  timePatterns: [],
  peakHour: null,
  dailyCompletions: null,
  aiSummary: '',
  aiTips: [],
  aiContentSource: 'AI',
  hasActivity: true,
  generatedAt: '2026-03-09T00:00:00.000Z',
});

/** GET /v1/ai/reports 목록의 한 리포트. 2026년 47주(11월 16~22일) 주간 리포트다 */
export const createAiReportDto = defineFixture(aiReportDtoSchema, {
  id: 11,
  type: 'WEEKLY',
  year: 2026,
  period: 47,
  periodLabel: '11월 3주차',
  dateRange: { startDate: '2026-11-16', endDate: '2026-11-22' },
  stats: {
    totalTodos: 20,
    completedTodos: 15,
    completionRate: 75,
    prevCompletionRate: 60,
    streakDays: 3,
    perfectDays: 2,
  },
  categoryBreakdown: [{ name: '업무', color: '#3B82F6', total: 10, completed: 9, rate: 90 }],
  dayPatterns: [],
  timePatterns: [
    { hour: 7, count: 6 },
    { hour: 21, count: 4 },
  ],
  peakHour: 7,
  aiSummary: '아침에 가장 많이 끝냈어요',
  aiTips: ['운동은 아침으로 옮겨 보세요'],
  hasActivity: true,
  generatedAt: '2026-11-22T21:00:00.000Z',
  dailyCompletions: [
    { date: '2026-11-16', total: 3, completed: 2 },
    { date: '2026-11-17', total: 3, completed: 3 },
    { date: '2026-11-18', total: 4, completed: 2 },
    { date: '2026-11-19', total: 3, completed: 2 },
    { date: '2026-11-20', total: 3, completed: 2 },
    { date: '2026-11-21', total: 2, completed: 2 },
    { date: '2026-11-22', total: 2, completed: 2 },
  ],
  aiContentSource: 'AI',
});

/** GET /v1/ai/reports/status의 상태. 서울 월요일 11월 30일 06:00에 주간, 12월 1일 06:00에 월간이 온다 */
export const createReportStatusDto = defineFixture(reportStatusSchema, {
  nextWeeklyAt: '2026-11-29T21:00:00.000Z',
  nextMonthlyAt: '2026-11-30T21:00:00.000Z',
  daysUntilWeekly: 5,
  daysUntilMonthly: 6,
  latestWeekly: null,
  latestMonthly: null,
});
