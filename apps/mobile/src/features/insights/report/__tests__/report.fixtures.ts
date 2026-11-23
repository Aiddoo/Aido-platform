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
