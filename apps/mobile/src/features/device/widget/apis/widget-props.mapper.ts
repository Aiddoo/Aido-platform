import { match } from 'ts-pattern';

import { WIDGET_BRAND_COLOR, WIDGET_LARGE_MAX_ROWS } from '../constants/widget.constants';
import type { WidgetRenderState } from '../domains/widget-snapshot.model';
import type { WidgetProps } from '../schemas/widget-props-payload.schema';
import type { WidgetDaySnapshot } from '../schemas/widget-snapshot-storage.schema';
import { isHexColor } from '../utils/widget-color.view-model';

export function toWidgetProps(
  snapshot: WidgetDaySnapshot,
  state: WidgetRenderState,
  appScheme: string,
): WidgetProps {
  const stateScreen = getWidgetStateScreenStrings(snapshot, state);
  const openAppUrl = `${appScheme}://feed?date=today`;

  return {
    state,
    maxRows: WIDGET_LARGE_MAX_ROWS,
    totalTodos: snapshot.totalTodos,
    completedTodos: snapshot.completedTodos,
    completionRate: snapshot.completionRate,
    isComplete: snapshot.isComplete,
    currentStreak: snapshot.currentStreak,
    topTodos: snapshot.topTodos.map((todo) => ({
      id: todo.id,
      title: todo.title,
      completed: todo.completed,
      color: isHexColor(todo.categoryColor) ? todo.categoryColor : WIDGET_BRAND_COLOR,
      destination: `${appScheme}://todo/${todo.id}`,
    })),
    openAppUrl,
    addTodoUrl: `${openAppUrl}&action=add-todo`,
    weekDays: snapshot.weekDays?.map((day) => ({
      ...day,
      isToday: day.date === snapshot.date,
      destination: `${appScheme}://feed?date=${day.date === snapshot.date ? 'today' : day.date}`,
    })),
    weekTitle: snapshot.strings.weekTitle,
    weekRangeLabel: snapshot.strings.weekRangeLabel,
    addTodoLabel: snapshot.strings.addTodoLabel ?? snapshot.strings.emptyCta,
    openTodoLabel: snapshot.strings.openTodoLabel,
    progressTitle: snapshot.strings.progressTitle,
    percentLabel: snapshot.strings.percentLabel,
    compactStreakLabel: snapshot.strings.compactStreakLabel ?? snapshot.strings.streakLabel,
    allDoneLabel: snapshot.strings.allDoneLabel,
    moreLabelTemplate: snapshot.strings.moreLabelTemplate,
    stateTitle: stateScreen.title,
    stateCta: stateScreen.cta,
  };
}

function getWidgetStateScreenStrings(
  snapshot: WidgetDaySnapshot,
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
