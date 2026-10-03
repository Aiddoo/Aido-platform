import { match } from 'ts-pattern';

import type { WidgetProps } from '../models/widget-props.model';
import { type WidgetRenderState, type WidgetSnapshot } from '../models/widget-snapshot.model';

export function toWidgetProps(snapshot: WidgetSnapshot, state: WidgetRenderState): WidgetProps {
  const stateScreen = getWidgetStateScreenStrings(snapshot, state);

  return {
    state,
    date: snapshot.date,
    opensApp: true,
    maxRows: 8,
    totalTodos: snapshot.totalTodos,
    completedTodos: snapshot.completedTodos,
    completionRate: snapshot.completionRate,
    isComplete: snapshot.isComplete,
    currentStreak: snapshot.currentStreak,
    topTodos: snapshot.topTodos.map((todo) => ({
      title: todo.title,
      completed: todo.completed,
      color: /^#[0-9a-f]{6}$/i.test(todo.categoryColor) ? todo.categoryColor : '#FF6B43',
    })),
    progressTitle: snapshot.strings.progressTitle,
    percentLabel: snapshot.strings.percentLabel,
    streakLabel: snapshot.strings.streakLabel,
    compactStreakLabel: snapshot.strings.compactStreakLabel ?? snapshot.strings.streakLabel,
    allDoneLabel: snapshot.strings.allDoneLabel,
    moreLabelTemplate: snapshot.strings.moreLabelTemplate,
    stateTitle: stateScreen.title,
    stateCta: stateScreen.cta,
    staleTitle: snapshot.strings.staleTitle,
    staleCta: snapshot.strings.staleCta,
  };
}

function getWidgetStateScreenStrings(
  snapshot: WidgetSnapshot,
  renderState: WidgetRenderState,
): { title: string; cta: string } {
  return match(renderState)
    .with('loggedOut', () => ({
      title: snapshot.strings.loggedOutTitle,
      cta: snapshot.strings.loggedOutCta,
    }))
    .with('stale', () => ({ title: snapshot.strings.staleTitle, cta: snapshot.strings.staleCta }))
    .with('data', 'empty', () => ({
      title: snapshot.strings.emptyTitle,
      cta: snapshot.strings.emptyCta,
    }))
    .exhaustive();
}
