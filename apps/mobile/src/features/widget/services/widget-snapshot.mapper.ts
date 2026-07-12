import type { ResolvedLanguage } from '@src/shared/preferences/language.preference';

import type { WidgetSnapshot, WidgetSnapshotStrings } from '../models/widget-snapshot.model';

/**
 * 오늘의 할 일 요약 입력 (GET v1/todos/summary 도메인 모델과 구조 동일).
 * todo feature에 직접 의존하지 않도록 구조적 타입으로 선언한다.
 */
export interface WidgetSummaryInput {
  date: string;
  totalTodos: number;
  completedTodos: number;
  completionRate: number;
  isComplete: boolean;
  currentStreak: number;
  topTodos: readonly {
    id: number;
    title: string;
    completed: boolean;
    categoryColor: string;
  }[];
}

/** 매퍼가 요구하는 최소 번역 함수 — i18next `t`가 그대로 만족한다 (순수성/테스트 용이성) */
export type WidgetTranslateFn = (
  key:
    | 'widget:progress.title'
    | 'widget:progress.label'
    | 'widget:progress.percent'
    | 'widget:progress.streak'
    | 'widget:progress.allDone'
    | 'widget:list.more'
    | 'widget:state.emptyTitle'
    | 'widget:state.emptyCta'
    | 'widget:state.loggedOutTitle'
    | 'widget:state.loggedOutCta'
    | 'widget:state.staleTitle'
    | 'widget:state.staleCta',
  params?: Record<string, number>,
) => string;

export interface WidgetSnapshotContext {
  t: WidgetTranslateFn;
  locale: ResolvedLanguage;
  now: Date;
}

/** 표시할 상위 할 일 최대 개수 (Large 위젯 기준) */
const TOP_TODOS_DISPLAY_LIMIT = 10;

function bakeStrings(
  t: WidgetTranslateFn,
  summary: Pick<
    WidgetSummaryInput,
    'completedTodos' | 'totalTodos' | 'completionRate' | 'currentStreak'
  >,
  overflowCount: number,
): WidgetSnapshotStrings {
  return {
    progressTitle: t('widget:progress.title'),
    progressLabel: t('widget:progress.label', {
      completed: summary.completedTodos,
      total: summary.totalTodos,
    }),
    percentLabel: t('widget:progress.percent', { rate: Math.round(summary.completionRate) }),
    streakLabel: t('widget:progress.streak', { count: summary.currentStreak }),
    allDoneLabel: t('widget:progress.allDone'),
    moreLabel: overflowCount > 0 ? t('widget:list.more', { count: overflowCount }) : '',
    emptyTitle: t('widget:state.emptyTitle'),
    emptyCta: t('widget:state.emptyCta'),
    loggedOutTitle: t('widget:state.loggedOutTitle'),
    loggedOutCta: t('widget:state.loggedOutCta'),
    staleTitle: t('widget:state.staleTitle'),
    staleCta: t('widget:state.staleCta'),
  };
}

/** 요약 → 위젯 스냅샷 (순수함수 — I/O 없음) */
export function toWidgetSnapshot(
  summary: WidgetSummaryInput,
  context: WidgetSnapshotContext,
): WidgetSnapshot {
  const topTodos = summary.topTodos.slice(0, TOP_TODOS_DISPLAY_LIMIT).map((todo) => ({
    id: todo.id,
    title: todo.title,
    completed: todo.completed,
    categoryColor: todo.categoryColor,
  }));
  const overflowCount = Math.max(0, summary.totalTodos - topTodos.length);

  return {
    version: 1,
    state: summary.totalTodos > 0 ? 'data' : 'empty',
    date: summary.date,
    updatedAtIso: context.now.toISOString(),
    totalTodos: summary.totalTodos,
    completedTodos: summary.completedTodos,
    completionRate: summary.completionRate,
    isComplete: summary.isComplete,
    currentStreak: summary.currentStreak,
    topTodos,
    locale: context.locale,
    strings: bakeStrings(context.t, summary, overflowCount),
  };
}

/** 비로그인 상태 스냅샷 (로그아웃/세션 종료 시 기록) */
export function toLoggedOutWidgetSnapshot(
  localDate: string,
  context: WidgetSnapshotContext,
): WidgetSnapshot {
  return {
    version: 1,
    state: 'loggedOut',
    date: localDate,
    updatedAtIso: context.now.toISOString(),
    totalTodos: 0,
    completedTodos: 0,
    completionRate: 0,
    isComplete: false,
    currentStreak: 0,
    topTodos: [],
    locale: context.locale,
    strings: bakeStrings(
      context.t,
      { completedTodos: 0, totalTodos: 0, completionRate: 0, currentStreak: 0 },
      0,
    ),
  };
}
