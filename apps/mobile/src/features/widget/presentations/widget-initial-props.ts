import en from '../../../shared/i18n/locales/en/widget.json';
import ko from '../../../shared/i18n/locales/ko/widget.json';
import type { WidgetProps } from '../models/widget-props.model';

export function createInitialWidgetProps(locale: 'ko' | 'en' = 'ko'): WidgetProps {
  const strings = locale === 'en' ? en : ko;

  return {
    state: 'loggedOut',
    date: '',
    opensApp: true,
    maxRows: 4,
    totalTodos: 0,
    completedTodos: 0,
    completionRate: 0,
    isComplete: false,
    currentStreak: 0,
    topTodos: [],
    addTodoLabel: strings.actions.addTodo,
    openTodoLabel: strings.actions.openTodo,
    progressTitle: '',
    percentLabel: '',
    streakLabel: '',
    compactStreakLabel: '',
    allDoneLabel: '',
    moreLabelTemplate: '',
    stateTitle: strings.state.loggedOutTitle,
    stateCta: strings.state.loggedOutCta,
    staleTitle: strings.state.staleTitle,
    staleCta: strings.state.staleCta,
  };
}
