import type { WidgetProps } from '../models/widget-props.model';
import {
  type WidgetRenderState,
  type WidgetSnapshot,
  WidgetSnapshotPolicy,
} from '../models/widget-snapshot.model';

export function toWidgetProps(snapshot: WidgetSnapshot, state: WidgetRenderState): WidgetProps {
  const stateScreen = WidgetSnapshotPolicy.stateScreenStrings(snapshot, state);

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
