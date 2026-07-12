import { z } from 'zod';

/**
 * 홈 위젯 스냅샷 — 위젯이 렌더하는 유일한 데이터 (단일 진실원).
 *
 * 위젯 프로세스(iOS 확장 / Android headless)는 네트워크·토큰에 접근하지 않고
 * 앱이 기록한 이 스냅샷만 읽어 렌더한다. 사용자 노출 문자열은 쓰기 시점에
 * localize되어 함께 저장된다(iOS 타임라인 props는 직렬화되어 i18n 불가).
 */
export const widgetSnapshotSchema = z.object({
  version: z.literal(1),
  /** data: 오늘 할 일 있음 · empty: 로그인했으나 오늘 할 일 없음 · loggedOut: 비로그인 */
  state: z.enum(['data', 'empty', 'loggedOut']),
  /** 스냅샷이 설명하는 로컬 날짜 (YYYY-MM-DD) — 자정 롤오버 판정 기준 */
  date: z.string(),
  updatedAtIso: z.string(),
  totalTodos: z.number().int().min(0),
  completedTodos: z.number().int().min(0),
  completionRate: z.number().min(0).max(100),
  isComplete: z.boolean(),
  currentStreak: z.number().int().min(0),
  topTodos: z
    .array(
      z.object({
        id: z.number().int(),
        title: z.string(),
        completed: z.boolean(),
        /** 카테고리 색상 (HEX) — 위젯 체크박스 컬러, 앱 홈과 동일한 시각 언어 */
        categoryColor: z.string(),
      }),
    )
    .max(10),
  locale: z.enum(['ko', 'en']),
  /** 쓰기 시점에 구워진 localized 문자열 — 위젯은 번역하지 않고 그대로 표시 */
  strings: z.object({
    progressTitle: z.string(),
    progressLabel: z.string(),
    percentLabel: z.string(),
    streakLabel: z.string(),
    allDoneLabel: z.string(),
    moreLabel: z.string(),
    emptyTitle: z.string(),
    emptyCta: z.string(),
    loggedOutTitle: z.string(),
    loggedOutCta: z.string(),
    staleTitle: z.string(),
    staleCta: z.string(),
  }),
});

export type WidgetSnapshot = z.infer<typeof widgetSnapshotSchema>;
export type WidgetSnapshotStrings = WidgetSnapshot['strings'];
export type WidgetTopTodo = WidgetSnapshot['topTodos'][number];

/** 위젯 렌더 시점의 표시 상태 — 스냅샷 상태에 자정 경과(stale)를 더한 판정 결과 */
export type WidgetRenderState = 'data' | 'empty' | 'loggedOut' | 'stale';

export const WidgetSnapshotPolicy = {
  /** 스냅샷이 설명하는 날짜가 지났는지 (자정 롤오버) */
  isStale(snapshot: WidgetSnapshot, todayLocalDate: string): boolean {
    return snapshot.state !== 'loggedOut' && snapshot.date !== todayLocalDate;
  },

  /** 렌더 시점 표시 상태 판정 — 위젯(양 플랫폼)과 테스트가 공유하는 단일 규칙 */
  renderState(snapshot: WidgetSnapshot, todayLocalDate: string): WidgetRenderState {
    if (snapshot.state === 'loggedOut') {
      return 'loggedOut';
    }
    if (WidgetSnapshotPolicy.isStale(snapshot, todayLocalDate)) {
      return 'stale';
    }
    return snapshot.state;
  },
} as const;
