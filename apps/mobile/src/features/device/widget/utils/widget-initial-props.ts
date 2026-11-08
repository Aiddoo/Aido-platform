// iOS 위젯 번들은 expo-widgets의 별도 Metro 설정(projectRoot가 expo-widgets)으로 빌드되어 앱의 `@src` 별칭이 풀리지 않는다.
// 이 파일과 widgets.ios.tsx가 부르는 모듈은 상대 경로만 쓴다.
import en from '../../../../shared/i18n/locales/en/widget.json';
import ko from '../../../../shared/i18n/locales/ko/widget.json';
import type { ResolvedLanguage } from '../../../../shared/preferences/language.preference';
import { WIDGET_LARGE_MAX_ROWS } from '../constants/widget.constants';
import type { WidgetProps } from '../schemas/widget-props.schema';

/** 첫 동기화 전(로그아웃 안내) props. 동기화 뒤에는 앱 언어로 만든 snapshot 문구를 쓴다. */
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

/**
 * 위젯 등록 initialProps. 빌드 시점에 layout registry로 고정되므로 첫 동기화 전 문구는 영어를 키로 넘기고
 * 위젯 번들의 Localizable.strings가 한국어 기기에서만 한국어로 바꾼다. SwiftUI Text는 환경 locale의
 * lproj를 찾고 없으면 키를 그대로 보여 주므로, 영어 키여야 ko·en 외 언어도 영어로 표시된다.
 */
export function createRegisteredWidgetProps(): WidgetProps {
  return { ...createInitialWidgetProps('en'), localizeStateCopy: true };
}
