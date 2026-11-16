import { DAYS_PER_WEEK } from '@src/shared/constants/time-units';
import {
  addDaysToDateKey,
  addMonthsToDateKey,
  type DateKey,
  diffDateKeysInDays,
  getDayOfWeek,
  getIsoWeekNumber,
  getIsoWeekYear,
  getMondayOfDateKey,
  getMonthEndDateKey,
  getMonthStartDateKey,
  getYearOfDateKey,
  toCivilDate,
} from '@src/shared/date/date-key';
import { getStartOfDateKey } from '@src/shared/date/zoned';
import { t } from '@src/shared/i18n';
import { range, sumBy, takeRightWhile } from 'es-toolkit';
import { match } from 'ts-pattern';

import { TREND_WEEK_COUNT } from '../constants/report-chart.constants';
import {
  SAMPLE_CATEGORY_SHARES,
  SAMPLE_COMPLETION_HOUR_WEIGHTS,
  SAMPLE_DAILY_TODO_COUNTS,
  SAMPLE_MISSED_TODO_COUNTS,
  SAMPLE_TRAILING_PERFECT_DAYS,
} from '../constants/sample-report.constants';
import type { AiReport, DailyCompletion, ReportType } from '../domains/report.model';

interface SampleTrendWeek {
  startDate: DateKey;
  completionRate: number;
}

interface SampleReportContext {
  todayKey: DateKey;
  /** 코치 글·카테고리 이름의 언어. 앱 언어가 바뀌면 다시 만들도록 인자로 받는다 */
  language: string;
}

/** 오늘을 기준으로 몇 기간 전(1이 지난주·지난달)의 예시 리포트를 만든다 */
export function createSampleReport(
  type: ReportType,
  periodsAgo: number,
  { todayKey, language }: SampleReportContext,
): AiReport {
  const dateRange = getSamplePeriod(type, periodsAgo, todayKey);
  const dailyCompletions = createSampleDays(type, periodsAgo, todayKey);
  const totalTodos = sumBy(dailyCompletions, (day) => day.total);
  const completedTodos = sumBy(dailyCompletions, (day) => day.completed);

  return {
    // 예시는 서버에 없어 id로 찾지 않는다. 화면은 종류와 몇 기간 전인지로 연다
    id: 0,
    type,
    year: getSamplePeriodYear(type, dateRange.startDate),
    period: getSamplePeriodNumber(type, dateRange.startDate),
    dateRange,
    stats: {
      totalTodos,
      completedTodos,
      completionRate: calculateCompletionRate(completedTodos, totalTodos),
      prevCompletionRate: getSampleCompletionRate(type, periodsAgo + 1, todayKey),
      streakDays: takeRightWhile(dailyCompletions, (day) => day.completed === day.total).length,
    },
    categoryBreakdown: createSampleCategories(totalTodos, completedTodos, language),
    timePatterns: createSampleTimePatterns(completedTodos),
    dailyCompletions,
    aiSummary: match(type)
      .with('WEEKLY', () => t('ai:report.sample.weekly.summary', { lng: language }))
      .with('MONTHLY', () => t('ai:report.sample.monthly.summary', { lng: language }))
      .exhaustive(),
    aiTips: match(type)
      .with('WEEKLY', () => [
        t('ai:report.sample.weekly.tips.workout', { lng: language }),
        t('ai:report.sample.weekly.tips.midweek', { lng: language }),
      ])
      .with('MONTHLY', () => [
        t('ai:report.sample.monthly.tips.repeat', { lng: language }),
        t('ai:report.sample.monthly.tips.morning', { lng: language }),
      ])
      .exhaustive(),
    aiContentSource: 'AI',
    hasActivity: true,
    // 리포트는 기간이 끝난 다음 날 만들어진다. 화면에 보이지 않는 값이다
    generatedAt: getStartOfDateKey(addDaysToDateKey(dateRange.endDate, 1), 'UTC'),
  };
}

/** 예시 최근 리포트 카드의 주별 완료율 추세. 오래된 주부터 온다 */
export function getSampleTrendWeeks(todayKey: DateKey): SampleTrendWeek[] {
  return range(TREND_WEEK_COUNT, 0, -1).map((weeksAgo) => ({
    startDate: getSamplePeriod('WEEKLY', weeksAgo, todayKey).startDate,
    completionRate: getSampleCompletionRate('WEEKLY', weeksAgo, todayKey),
  }));
}

function getSamplePeriod(
  type: ReportType,
  periodsAgo: number,
  todayKey: DateKey,
): AiReport['dateRange'] {
  return match(type)
    .with('WEEKLY', () => {
      const startDate = addDaysToDateKey(getMondayOfDateKey(todayKey), -DAYS_PER_WEEK * periodsAgo);
      return { startDate, endDate: addDaysToDateKey(startDate, DAYS_PER_WEEK - 1) };
    })
    .with('MONTHLY', () => {
      const startDate = getMonthStartDateKey(addMonthsToDateKey(todayKey, -periodsAgo));
      return { startDate, endDate: getMonthEndDateKey(startDate) };
    })
    .exhaustive();
}

function createSampleDays(
  type: ReportType,
  periodsAgo: number,
  todayKey: DateKey,
): DailyCompletion[] {
  const { startDate, endDate } = getSamplePeriod(type, periodsAgo, todayKey);
  const missedCounts = SAMPLE_MISSED_TODO_COUNTS[type][periodsAgo - 1];
  const dayCount = diffDateKeysInDays(startDate, endDate) + 1;
  const firstPerfectOffset = dayCount - (SAMPLE_TRAILING_PERFECT_DAYS[type][periodsAgo - 1] ?? 0);

  return range(dayCount).map((offset) => {
    const date = addDaysToDateKey(startDate, offset);
    // 표는 월요일부터다
    const weekday = (getDayOfWeek(date) + DAYS_PER_WEEK - 1) % DAYS_PER_WEEK;
    // 월간 막대가 주마다 똑같이 되풀이되지 않게 못 끝낸 요일을 주마다 하루씩 민다
    const missedDay = (weekday + Math.floor(offset / DAYS_PER_WEEK)) % DAYS_PER_WEEK;
    const total = SAMPLE_DAILY_TODO_COUNTS[weekday] ?? 0;
    const missed = firstPerfectOffset <= offset ? 0 : (missedCounts?.[missedDay] ?? 0);
    return { date, total, completed: total - missed };
  });
}

function getSampleCompletionRate(type: ReportType, periodsAgo: number, todayKey: DateKey) {
  const days = createSampleDays(type, periodsAgo, todayKey);
  return calculateCompletionRate(
    sumBy(days, (day) => day.completed),
    sumBy(days, (day) => day.total),
  );
}

/** 서버 집계와 같이 반올림한 백분율이다 */
function calculateCompletionRate(completedTodos: number, totalTodos: number): number {
  return totalTodos > 0 ? Math.round((completedTodos / totalTodos) * 100) : 0;
}

function createSampleCategories(
  totalTodos: number,
  completedTodos: number,
  language: string,
): AiReport['categoryBreakdown'] {
  const { work, study, workout } = SAMPLE_CATEGORY_SHARES;
  const missedTodos = totalTodos - completedTodos;
  const workTodos = Math.round(totalTodos * work.todoShare);
  const workMissed = Math.round(missedTodos * work.missedShare);
  const studyTodos = Math.round(totalTodos * study.todoShare);
  const studyMissed = Math.round(missedTodos * study.missedShare);

  return [
    createSampleCategory(
      t('ai:report.sample.categories.work', { lng: language }),
      work.color,
      workTodos,
      workMissed,
    ),
    createSampleCategory(
      t('ai:report.sample.categories.study', { lng: language }),
      study.color,
      studyTodos,
      studyMissed,
    ),
    createSampleCategory(
      t('ai:report.sample.categories.workout', { lng: language }),
      workout.color,
      totalTodos - workTodos - studyTodos,
      missedTodos - workMissed - studyMissed,
    ),
  ];
}

function createSampleCategory(
  name: string,
  color: string,
  total: number,
  missed: number,
): AiReport['categoryBreakdown'][number] {
  const completed = total - missed;
  return { name, color, total, completed, rate: calculateCompletionRate(completed, total) };
}

function createSampleTimePatterns(completedTodos: number): AiReport['timePatterns'] {
  const weightSum = sumBy(SAMPLE_COMPLETION_HOUR_WEIGHTS, (item) => item.weight);
  const patterns = SAMPLE_COMPLETION_HOUR_WEIGHTS.map(({ hour, weight }) => ({
    hour,
    count: Math.floor((completedTodos * weight) / weightSum),
  }));
  // 나눠 떨어지지 않은 몫은 가장 많이 끝낸 첫 시각에 더해 합이 끝낸 할 일 수와 같다
  const remainder = completedTodos - sumBy(patterns, (pattern) => pattern.count);
  return patterns.map((pattern, index) =>
    index === 0 ? { ...pattern, count: pattern.count + remainder } : pattern,
  );
}

function getSamplePeriodYear(type: ReportType, startDate: DateKey): number {
  return match(type)
    .with('WEEKLY', () => getIsoWeekYear(startDate))
    .with('MONTHLY', () => getYearOfDateKey(startDate))
    .exhaustive();
}

function getSamplePeriodNumber(type: ReportType, startDate: DateKey): number {
  return match(type)
    .with('WEEKLY', () => getIsoWeekNumber(startDate))
    .with('MONTHLY', () => toCivilDate(startDate).month)
    .exhaustive();
}
