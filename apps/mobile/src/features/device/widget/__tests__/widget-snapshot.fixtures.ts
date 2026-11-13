import { toInstant } from '@src/shared/date/instant';
import { createDateKey } from '@src/testing/date-key';
import { defineFixture } from '@src/testing/fixture';

import type { WidgetSnapshotContext, WidgetSummaryInput } from '../apis/widget-snapshot.mapper';
import {
  type WidgetDaySnapshot,
  widgetDaySnapshotSchema,
  widgetSnapshotSchema,
} from '../schemas/widget-snapshot-storage.schema';

/** t를 key(params) 형태로 에코해 굽기 로직을 검증할 수 있게 한다 */
export const echoTranslate: WidgetSnapshotContext['t'] = (key, params) =>
  params ? `${key}(${JSON.stringify(params)})` : key;

export function createWidgetSnapshotContext(
  overrides: Partial<WidgetSnapshotContext> = {},
): WidgetSnapshotContext {
  return {
    t: echoTranslate,
    locale: 'ko',
    now: toInstant('2026-07-12T09:00:00.000Z'),
    timeZone: 'Asia/Seoul',
    ...overrides,
  };
}

export function createWidgetSummary(
  overrides: Partial<WidgetSummaryInput> = {},
): WidgetSummaryInput {
  return {
    date: createDateKey('2026-07-12'),
    totalTodos: 5,
    completedTodos: 3,
    completionRate: 60,
    isComplete: false,
    currentStreak: 12,
    topTodos: [
      { id: 1, title: '운동하기', completed: true, categoryColor: '#B3E5C1' },
      { id: 2, title: '회의 자료 준비', completed: false, categoryColor: '#FFB3B3' },
    ],
    ...overrides,
  };
}

export const createWidgetDaySnapshot = defineFixture(widgetDaySnapshotSchema, {
  state: 'data',
  date: '2026-07-12',
  totalTodos: 5,
  completedTodos: 3,
  completionRate: 60,
  isComplete: false,
  currentStreak: 12,
  topTodos: [{ id: 1, title: '운동하기', completed: true, categoryColor: '#B3E5C1' }],
  locale: 'ko',
  strings: {
    progressTitle: '오늘의 할 일',
    percentLabel: '60%',
    streakLabel: '12일 연속',
    compactStreakLabel: '12일',
    allDoneLabel: '모두 완료!',
    moreLabelTemplate: '+{count}개 더',
    emptyTitle: '오늘 할 일이 없어요',
    emptyCta: '탭해서 추가하기',
    loggedOutTitle: '로그인이 필요해요',
    loggedOutCta: '탭해서 시작하기',
    staleTitle: '새로운 하루가 시작됐어요',
    staleCta: '앱을 열어 확인하기',
  },
});

const widgetSnapshot = defineFixture(widgetSnapshotSchema, {
  version: 2,
  updatedAtIso: '2026-07-12T09:00:00.000Z',
  days: [createWidgetDaySnapshot()],
});

/** 인자 하나가 day 하나다. 생략하면 2026-07-12 하루짜리 v2 snapshot을 만든다. */
export function createWidgetSnapshot(
  todayOverrides: Partial<WidgetDaySnapshot> = {},
  tomorrowOverrides?: Partial<WidgetDaySnapshot>,
) {
  const today = createWidgetDaySnapshot(todayOverrides);
  if (tomorrowOverrides == null) {
    return widgetSnapshot({ days: [today] });
  }
  const tomorrow = createWidgetDaySnapshot({
    date: createDateKey('2026-07-13'),
    ...tomorrowOverrides,
  });
  return widgetSnapshot({ days: [today, tomorrow] });
}
