/**
 * iOS 위젯 타임라인 props — 직렬화되어 위젯 확장으로 전달된다.
 *
 * 레이아웃 함수('widget' 디렉티브)는 모듈 스코프를 참조할 수 없으므로,
 * 렌더에 필요한 모든 값(표시 상태·문자열 포함)을 엔트리 시점에 미리 계산해 담는다.
 * 자정 롤오버는 stale 상태의 두 번째 타임라인 엔트리로 처리한다.
 */
export interface IosWidgetProps {
  /** 렌더 표시 상태 — 엔트리 생성 시점에 확정 (stale = 자정 이후 엔트리) */
  state: 'data' | 'empty' | 'loggedOut' | 'stale';
  totalTodos: number;
  completedTodos: number;
  /** 0-100 */
  completionRate: number;
  isComplete: boolean;
  currentStreak: number;
  topTodos: { title: string; completed: boolean }[];
  /** 쓰기 시점에 구워진 localized 문자열 */
  progressTitle: string;
  progressLabel: string;
  percentLabel: string;
  streakLabel: string;
  allDoneLabel: string;
  moreLabel: string;
  /** state !== 'data'일 때 표시할 안내 문구 (상태별로 미리 선택됨) */
  stateTitle: string;
  stateCta: string;
}
