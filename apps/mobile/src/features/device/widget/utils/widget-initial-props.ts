// iOS 위젯 번들은 expo-widgets의 별도 Metro 설정(projectRoot가 expo-widgets)으로 빌드되어 앱의 `@src` 별칭이 풀리지 않는다
import en from '../../../../shared/i18n/locales/en/widget.json';
import ko from '../../../../shared/i18n/locales/ko/widget.json';
import type { ResolvedLanguage } from '../../../../shared/preferences/language.preference';
import { WIDGET_LARGE_MAX_ROWS } from '../constants/widget.constants';
import type { WidgetProps } from '../schemas/widget-props.schema';

export function createInitialWidgetProps(locale: ResolvedLanguage): WidgetProps {
  const strings = locale === 'en' ? en : ko;

  return {
    state: 'loggedOut',
    maxRows: WIDGET_LARGE_MAX_ROWS,
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
    compactStreakLabel: '',
    allDoneLabel: '',
    moreLabelTemplate: '',
    stateTitle: strings.state.loggedOutTitle,
    stateCta: strings.state.loggedOutCta,
  };
}

/** 위젯 등록 initialProps */
export function createRegisteredWidgetProps(): WidgetProps {
  return { ...createInitialWidgetProps('en'), localizeStateCopy: true };
}
