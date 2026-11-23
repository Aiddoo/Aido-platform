import type { DayOfWeek } from '@aido/api/vocabulary';
import { dateKeySchema } from '@src/shared/date/date-key';
import { toInstant } from '@src/shared/date/instant';

/** 소개 단계 순서. 이름은 지표 값(whats_new_step_viewed.step)이라 바꾸지 않는다 */
export const RELEASE_1_16_0_STEPS = [
  'intro',
  'suggestionRequest',
  'suggestionList',
  'reportSummary',
  'reportHours',
  'freeRecord',
  'finish',
] as const;

/** 최근 2주 기록에서 찾았다고 보여 줄 제안이다. 제목은 카탈로그 `v1_16_0.demo.suggestions`에 있다 */
export const DEMO_SUGGESTIONS = [
  {
    id: 'workout',
    daysOfWeek: ['MON', 'WED', 'FRI'],
    scheduledTime: '07:00',
    evidence: { recordedCount: 6, completedCount: 5, periodDays: 14 },
  },
  {
    id: 'vitamins',
    daysOfWeek: ['MON', 'TUE', 'WED', 'THU', 'FRI'],
    scheduledTime: '08:30',
    evidence: { recordedCount: 10, completedCount: 9, periodDays: 14 },
  },
] as const satisfies readonly {
  id: string;
  daysOfWeek: readonly DayOfWeek[];
  scheduledTime: string;
  evidence: { recordedCount: number; completedCount: number; periodDays: number };
}[];

/** 서버가 알려 주는 다음 아침 분석 시각(현지 9시)과 같다 */
export const DEMO_NEXT_ANALYSIS_TIME = '09:00';

/** 지난주 주간 리포트다. 날짜를 고정해 연·주차가 기간과 맞는다 */
export const DEMO_REPORT = {
  year: 2026,
  period: 46,
  startDate: dateKeySchema.parse('2026-11-09'),
  endDate: dateKeySchema.parse('2026-11-15'),
  generatedAt: toInstant('2026-11-15T15:00:00.000Z'),
  stats: {
    totalTodos: 32,
    completedTodos: 25,
    completionRate: 78,
    prevCompletionRate: 66,
    streakDays: 7,
    perfectDays: 2,
  },
  dailyCompletions: [
    { total: 5, completed: 4 },
    { total: 6, completed: 6 },
    { total: 4, completed: 3 },
    { total: 5, completed: 5 },
    { total: 6, completed: 4 },
    { total: 3, completed: 2 },
    { total: 3, completed: 1 },
  ],
  timePatterns: [
    { hour: 7, count: 6 },
    { hour: 8, count: 4 },
    { hour: 9, count: 2 },
    { hour: 12, count: 3 },
    { hour: 13, count: 1 },
    { hour: 18, count: 2 },
    { hour: 21, count: 5 },
    { hour: 22, count: 2 },
  ],
  peakHour: 7,
} as const;

/** 무료로 보는 이번 주 기록이다. 목요일을 오늘로 두어 금·토·일은 아직 오지 않은 날로 보인다 */
export const DEMO_THIS_WEEK = {
  todayKey: dateKeySchema.parse('2026-11-19'),
  completionsByDate: {
    '2026-11-16': { totalTodos: 4, completedTodos: 3 },
    '2026-11-17': { totalTodos: 5, completedTodos: 5 },
    '2026-11-18': { totalTodos: 3, completedTodos: 2 },
    '2026-11-19': { totalTodos: 4, completedTodos: 1 },
  },
} as const;

export const DEMO_SCRIPT_MS = {
  suggestionRow: 320,
  analyzingCard: 1_500,
  peakHourSelectDelay: 900,
} as const;
