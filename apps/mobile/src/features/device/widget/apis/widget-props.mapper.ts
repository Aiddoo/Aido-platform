// widgets.ios.tsx의 위젯 번들은 상대 경로 밖 import를 빈 모듈로 풀어 이 파일은 상대 경로 값·타입 import만 쓴다
import { WIDGET_BRAND_COLOR, WIDGET_LARGE_MAX_ROWS } from '../constants/widget.constants';
import type { WidgetRenderState } from '../domains/widget-snapshot.model';
import type { WidgetProps } from '../schemas/widget-props-payload.schema';
import type { StoredWidgetDay } from '../schemas/widget-snapshot-storage.schema';

/** 첫 동기화 전 로그인 안내에 쓰는 문구 */
export interface InitialWidgetCopy {
  addTodoLabel: string;
  openTodoLabel: string;
  stateTitle: string;
  stateCta: string;
}

/** 위젯 렌더러는 HEX 색만 그린다. 손상된 카테고리 색은 null이다 */
export function parseWidgetColor(value: string): `#${string}` | null {
  return /^#[0-9a-f]{6}$/i.test(value) ? `#${value.slice(1)}` : null;
}

/** 위젯이 앱을 깨우는 기본 주소. 출시한 위젯이 쓰는 외부 계약이다 */
export function toWidgetOpenAppUrl(appScheme: string) {
  return `${appScheme}://feed?date=today`;
}

export function toWidgetProps(
  snapshot: StoredWidgetDay,
  state: WidgetRenderState,
  appScheme: string,
): WidgetProps {
  const stateScreen = getWidgetStateScreenStrings(snapshot, state);
  const openAppUrl = toWidgetOpenAppUrl(appScheme);

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
      color: parseWidgetColor(todo.categoryColor) ?? WIDGET_BRAND_COLOR,
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
  { strings }: StoredWidgetDay,
  renderState: WidgetRenderState,
): { title: string; cta: string } {
  // 위젯 번들에서는 패키지(ts-pattern)가 빈 모듈이라 표로 고른다. 상태가 늘면 satisfies가 빌드를 막는다
  const screens = {
    loggedOut: { title: strings.loggedOutTitle, cta: strings.loggedOutCta },
    stale: { title: strings.staleTitle, cta: strings.staleCta },
    data: { title: strings.emptyTitle, cta: strings.emptyCta },
    empty: { title: strings.emptyTitle, cta: strings.emptyCta },
  } satisfies Record<WidgetRenderState, { title: string; cta: string }>;
  return screens[renderState];
}

/** 첫 동기화 전(로그아웃 안내) props. 동기화 뒤에는 앱 언어로 만든 snapshot 문구를 쓴다. */
export function toInitialWidgetProps(copy: InitialWidgetCopy): WidgetProps {
  return {
    state: 'loggedOut',
    maxRows: WIDGET_LARGE_MAX_ROWS,
    totalTodos: 0,
    completedTodos: 0,
    completionRate: 0,
    isComplete: false,
    currentStreak: 0,
    topTodos: [],
    addTodoLabel: copy.addTodoLabel,
    openTodoLabel: copy.openTodoLabel,
    progressTitle: '',
    percentLabel: '',
    compactStreakLabel: '',
    allDoneLabel: '',
    moreLabelTemplate: '',
    stateTitle: copy.stateTitle,
    stateCta: copy.stateCta,
  };
}

// 빌드 때 고정되는 iOS 첫 props다. 문구는 위젯 번들의 Localizable.strings 키로 넘겨 렌더러가 기기 언어로 바꾼다
export function toRegisteredWidgetProps(copy: InitialWidgetCopy): WidgetProps {
  return { ...toInitialWidgetProps(copy), localizeStateCopy: true };
}
