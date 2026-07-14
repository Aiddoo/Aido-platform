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
    | 'widget:progress.percent'
    | 'widget:progress.streak'
    | 'widget:progress.compactStreak'
    | 'widget:progress.allDone'
    | 'widget:list.more'
    | 'widget:state.emptyTitle'
    | 'widget:state.emptyCta'
    | 'widget:state.loggedOutTitle'
    | 'widget:state.loggedOutCta'
    | 'widget:state.staleTitle'
    | 'widget:state.staleCta',
  params?: Record<string, string | number>,
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
): WidgetSnapshotStrings {
  return {
    progressTitle: t('widget:progress.title'),
    percentLabel: t('widget:progress.percent', { rate: Math.round(summary.completionRate) }),
    streakLabel: t('widget:progress.streak', { count: summary.currentStreak }),
    compactStreakLabel: t('widget:progress.compactStreak', { count: summary.currentStreak }),
    allDoneLabel: t('widget:progress.allDone'),
    // 표시 행 수(3~8행)는 위젯 크기에 따라 렌더 시점에 정해지므로 카운트는 굽지 않는다.
    // 어순/번역은 카탈로그가 소유하고, 위젯은 {count}만 실제 초과분으로 치환한다.
    moreLabelTemplate: t('widget:list.more', { overflow: '{count}' }),
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
    strings: bakeStrings(context.t, summary),
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
    strings: bakeStrings(context.t, {
      completedTodos: 0,
      totalTodos: 0,
      completionRate: 0,
      currentStreak: 0,
    }),
  };
}
