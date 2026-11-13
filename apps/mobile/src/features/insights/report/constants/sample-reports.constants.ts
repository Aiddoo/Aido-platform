import { dateKeySchema } from '@src/shared/date/date-key';
import { toInstant } from '@src/shared/date/instant';
import { t } from '@src/shared/i18n';

import type { AiReport, ReportType } from '../domains/report.model';

export const SAMPLE_REPORT_IDS = {
  WEEKLY: 'sample-weekly',
  MONTHLY: 'sample-monthly',
} as const satisfies Record<ReportType, string>;

// 표시 시점 언어를 따르도록 모듈 로드 때 t()를 부르지 않고 빌더 함수로 만든다
function buildWeeklySampleReport(): AiReport {
  return {
    id: -1,
    type: 'WEEKLY',
    year: 2026,
    period: 10,
    dateRange: {
      startDate: dateKeySchema.parse('2026-03-02'),
      endDate: dateKeySchema.parse('2026-03-08'),
    },
    stats: {
      totalTodos: 35,
      completedTodos: 29,
      completionRate: 83,
      prevCompletionRate: 76,
      streakDays: 5,
    },
    categoryBreakdown: [
      {
        name: t('ai:sampleReport.categories.work'),
        color: '#FF6B6B',
        total: 12,
        completed: 11,
        rate: 92,
      },
      {
        name: t('ai:sampleReport.categories.selfDev'),
        color: '#4ECDC4',
        total: 7,
        completed: 6,
        rate: 86,
      },
      {
        name: t('ai:sampleReport.categories.health'),
        color: '#45B7D1',
        total: 7,
        completed: 5,
        rate: 71,
      },
      {
        name: t('ai:sampleReport.categories.life'),
        color: '#FFD93D',
        total: 5,
        completed: 4,
        rate: 80,
      },
      {
        name: t('ai:sampleReport.categories.side'),
        color: '#6C5CE7',
        total: 4,
        completed: 3,
        rate: 75,
      },
    ],
    dayPatterns: [
      { day: 'MON', total: 6, completed: 6, rate: 100 },
      { day: 'TUE', total: 6, completed: 5, rate: 83 },
      { day: 'WED', total: 5, completed: 3, rate: 60 },
      { day: 'THU', total: 5, completed: 5, rate: 100 },
      { day: 'FRI', total: 5, completed: 4, rate: 80 },
      { day: 'SAT', total: 4, completed: 3, rate: 75 },
      { day: 'SUN', total: 4, completed: 3, rate: 75 },
    ],
    timePatterns: [
      { hour: 9, count: 9 },
      { hour: 19, count: 7 },
      { hour: 7, count: 5 },
      { hour: 14, count: 4 },
      { hour: 22, count: 3 },
      { hour: 12, count: 2 },
    ],
    aiSummary: t('ai:sampleReport.weekly.summary'),
    aiTips: [
      t('ai:sampleReport.weekly.tip1'),
      t('ai:sampleReport.weekly.tip2'),
      t('ai:sampleReport.weekly.tip3'),
      t('ai:sampleReport.weekly.tip4'),
    ],
    hasActivity: true,
    generatedAt: toInstant('2026-03-09T00:00:00.000Z'),
  };
}

function buildMonthlySampleReport(): AiReport {
  return {
    id: -2,
    type: 'MONTHLY',
    year: 2026,
    period: 2,
    dateRange: {
      startDate: dateKeySchema.parse('2026-02-01'),
      endDate: dateKeySchema.parse('2026-02-28'),
    },
    stats: {
      totalTodos: 156,
      completedTodos: 128,
      completionRate: 82,
      prevCompletionRate: 74,
      streakDays: 9,
    },
    categoryBreakdown: [
      {
        name: t('ai:sampleReport.categories.work'),
        color: '#FF6B6B',
        total: 54,
        completed: 49,
        rate: 91,
      },
      {
        name: t('ai:sampleReport.categories.selfDev'),
        color: '#4ECDC4',
        total: 32,
        completed: 27,
        rate: 84,
      },
      {
        name: t('ai:sampleReport.categories.health'),
        color: '#45B7D1',
        total: 28,
        completed: 21,
        rate: 75,
      },
      {
        name: t('ai:sampleReport.categories.life'),
        color: '#FFD93D',
        total: 24,
        completed: 19,
        rate: 79,
      },
      {
        name: t('ai:sampleReport.categories.side'),
        color: '#6C5CE7',
        total: 18,
        completed: 12,
        rate: 67,
      },
    ],
    dayPatterns: [
      { day: 'MON', total: 25, completed: 22, rate: 88 },
      { day: 'TUE', total: 24, completed: 21, rate: 88 },
      { day: 'WED', total: 23, completed: 17, rate: 74 },
      { day: 'THU', total: 23, completed: 20, rate: 87 },
      { day: 'FRI', total: 22, completed: 18, rate: 82 },
      { day: 'SAT', total: 20, completed: 15, rate: 75 },
      { day: 'SUN', total: 19, completed: 15, rate: 79 },
    ],
    timePatterns: [
      { hour: 9, count: 38 },
      { hour: 19, count: 28 },
      { hour: 14, count: 22 },
      { hour: 7, count: 18 },
      { hour: 22, count: 14 },
      { hour: 12, count: 10 },
    ],
    aiSummary: t('ai:sampleReport.monthly.summary'),
    aiTips: [
      t('ai:sampleReport.monthly.tip1'),
      t('ai:sampleReport.monthly.tip2'),
      t('ai:sampleReport.monthly.tip3'),
      t('ai:sampleReport.monthly.tip4'),
    ],
    hasActivity: true,
    generatedAt: toInstant('2026-03-01T00:00:00.000Z'),
  };
}

type SampleReportId = (typeof SAMPLE_REPORT_IDS)[ReportType];

const SAMPLE_REPORT_BUILDERS: Record<SampleReportId, () => AiReport> = {
  [SAMPLE_REPORT_IDS.WEEKLY]: buildWeeklySampleReport,
  [SAMPLE_REPORT_IDS.MONTHLY]: buildMonthlySampleReport,
};

export function isSampleReportId(id: string): id is SampleReportId {
  return Object.hasOwn(SAMPLE_REPORT_BUILDERS, id);
}

export function getSampleReport(id: SampleReportId): AiReport {
  return SAMPLE_REPORT_BUILDERS[id]();
}
