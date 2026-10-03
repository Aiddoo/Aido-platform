import { z } from 'zod';

// Persist only display data; isolated widget runtimes cannot access auth or i18n.
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
    percentLabel: z.string(),
    streakLabel: z.string(),
    /** Small family 전용 짧은 스트릭. optional은 v1.5.1 스냅샷 하위 호환용이다. */
    compactStreakLabel: z.string().optional(),
    allDoneLabel: z.string(),
    /** "+N개 더" 템플릿 — 표시 행 수는 렌더 시점에만 알 수 있으므로 {count}를 위젯이 치환 */
    moreLabelTemplate: z.string(),
    emptyTitle: z.string(),
    emptyCta: z.string(),
    loggedOutTitle: z.string(),
    loggedOutCta: z.string(),
    staleTitle: z.string(),
    staleCta: z.string(),
  }),
});

export type WidgetSnapshot = z.infer<typeof widgetSnapshotSchema>;
export type WidgetSnapshotStrings = z.infer<typeof widgetSnapshotSchema.shape.strings>;

/** 위젯 렌더 시점의 표시 상태 — 스냅샷 상태에 자정 경과(stale)를 더한 판정 결과 */
export const widgetRenderStateSchema = z.enum(['data', 'empty', 'loggedOut', 'stale']);
export type WidgetRenderState = z.infer<typeof widgetRenderStateSchema>;

export function isWidgetSnapshotStale(snapshot: WidgetSnapshot, todayLocalDate: string): boolean {
  return snapshot.state !== 'loggedOut' && snapshot.date !== todayLocalDate;
}

export function getWidgetRenderState(
  snapshot: WidgetSnapshot,
  todayLocalDate: string,
): WidgetRenderState {
  return isWidgetSnapshotStale(snapshot, todayLocalDate) ? 'stale' : snapshot.state;
}

export const WidgetSnapshotPolicy = {
  isStale: isWidgetSnapshotStale,
  renderState: getWidgetRenderState,
};
