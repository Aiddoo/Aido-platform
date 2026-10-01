import type { WidgetRenderState } from './widget-snapshot.model';

export interface WidgetProps {
  state: WidgetRenderState;
  date: string;
  opensApp: boolean;
  maxRows: number;
  totalTodos: number;
  completedTodos: number;
  completionRate: number;
  isComplete: boolean;
  currentStreak: number;
  topTodos: { title: string; completed: boolean; color: string }[];
  progressTitle: string;
  percentLabel: string;
  streakLabel: string;
  compactStreakLabel: string;
  allDoneLabel: string;
  moreLabelTemplate: string;
  stateTitle: string;
  stateCta: string;
  staleTitle: string;
  staleCta: string;
}
