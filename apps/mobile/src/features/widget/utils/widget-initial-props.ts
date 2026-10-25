import en from '../../../shared/i18n/locales/en/widget.json';
import ko from '../../../shared/i18n/locales/ko/widget.json';
import type { ResolvedLanguage } from '../../../shared/preferences/language.preference';
import type { WidgetProps } from '../domains/widget-props.model';

/** 첫 동기화 전(로그아웃 안내) props. 동기화 뒤에는 앱 언어로 만든 snapshot 문구를 쓴다. */
export function createInitialWidgetProps(locale: ResolvedLanguage): WidgetProps {
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
