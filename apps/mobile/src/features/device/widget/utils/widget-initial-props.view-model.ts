// iOS 위젯 번들은 expo-widgets의 별도 Metro 설정으로 빌드되어 `@src` 별칭이 풀리지 않아 이 파일과 widgets.ios.tsx가 부르는 모듈은 상대 경로만 쓴다
import en from '../../../../shared/i18n/locales/en/widget.json';
import ko from '../../../../shared/i18n/locales/ko/widget.json';
import type { ResolvedLanguage } from '../../../../shared/preferences/language.preference';
import { WIDGET_LARGE_MAX_ROWS } from '../constants/widget.constants';
import type { WidgetProps } from '../schemas/widget-props-payload.schema';

const WIDGET_STRINGS = { ko, en } as const satisfies Record<ResolvedLanguage, typeof ko>;

/** 첫 동기화 전(로그아웃 안내) props. 동기화 뒤에는 앱 언어로 만든 snapshot 문구를 쓴다. */
export function createInitialWidgetProps(locale: ResolvedLanguage): WidgetProps {
  const strings = WIDGET_STRINGS[locale];

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

// 빌드 때 고정되는 문구라 영어 키로 넘긴다. SwiftUI Text는 lproj가 없으면 키를 보이므로 ko 외 언어도 영어로 보인다
export function createRegisteredWidgetProps(): WidgetProps {
  return { ...createInitialWidgetProps('en'), localizeStateCopy: true };
}
