// widgets.ios.tsx의 위젯 번들은 상대 경로 밖 import를 빈 모듈로 풀어 상대 경로 값만 쓰고 기본 언어는 타입으로만 묶는다
import type { FALLBACK_LOCALE } from '@aido/api/vocabulary';

import en from '../../../../shared/i18n/locales/en/widget.json';
import ko from '../../../../shared/i18n/locales/ko/widget.json';
import type { ResolvedLanguage } from '../../../../shared/preferences/language.preference';
import type { InitialWidgetCopy } from '../apis/widget-props.mapper';

const WIDGET_STRINGS = { ko, en } as const satisfies Record<ResolvedLanguage, typeof ko>;

/** 첫 동기화 전 로그인 안내 문구. 앱 i18n이 없는 위젯 프로세스라 카탈로그를 직접 읽는다 */
export function getInitialWidgetCopy(locale: ResolvedLanguage): InitialWidgetCopy {
  const strings = WIDGET_STRINGS[locale];

  return {
    addTodoLabel: strings.actions.addTodo,
    openTodoLabel: strings.actions.openTodo,
    stateTitle: strings.state.loggedOutTitle,
    stateCta: strings.state.loggedOutCta,
  };
}

// 빌드 때 고정되는 문구라 영어 키로 넘긴다. SwiftUI Text는 lproj가 없으면 키를 보이므로 ko 외 언어도 영어로 보인다
export function getRegisteredWidgetCopy(): InitialWidgetCopy {
  return getInitialWidgetCopy('en' satisfies typeof FALLBACK_LOCALE);
}
