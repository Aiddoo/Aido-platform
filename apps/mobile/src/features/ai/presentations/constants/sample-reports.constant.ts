import { t } from '@src/shared/i18n';

import type { AiReport } from '../../models/ai.model';

// 샘플 리포트는 표시 시점 언어를 따라야 하므로 상수가 아닌 빌더 함수로 구성한다
// (모듈 로드 시점 t() 평가 금지 규칙)
const buildWeeklySampleReport = (): AiReport => ({
  id: -1,
  type: 'WEEKLY',
  year: 2026,
  period: 10,
  periodLabel: t('ai:sampleReport.weekly.periodLabel'),
  dateRange: { startDate: '2026-03-02', endDate: '2026-03-08' },
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
  generatedAt: new Date('2026-03-09T00:00:00.000Z'),
});

const buildMonthlySampleReport = (): AiReport => ({
  id: -2,
  type: 'MONTHLY',
  year: 2026,
  period: 2,
  periodLabel: t('ai:sampleReport.monthly.periodLabel'),
  dateRange: { startDate: '2026-02-01', endDate: '2026-02-28' },
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
  generatedAt: new Date('2026-03-01T00:00:00.000Z'),
});

/** 샘플 route param → 빌더 매핑 (표시 시점 언어 반영) */
const SAMPLE_REPORT_BUILDERS: Record<string, () => AiReport> = {
  'sample-weekly': buildWeeklySampleReport,
  'sample-monthly': buildMonthlySampleReport,
};

/** route param이 샘플 리포트 ID인지 판별 */
export const isSampleReportId = (id?: string): boolean => !!id && id in SAMPLE_REPORT_BUILDERS;

/** 샘플 리포트 조회 (없으면 주간 폴백) */
export const getSampleReport = (id?: string): AiReport =>
  ((id ? SAMPLE_REPORT_BUILDERS[id] : undefined) ?? buildWeeklySampleReport)();
