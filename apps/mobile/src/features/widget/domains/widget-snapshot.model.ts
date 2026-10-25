import { omit } from 'es-toolkit';
import { z } from 'zod';

// Persist only display data; isolated widget runtimes cannot access auth or i18n.
/** 하루치 표시 데이터. v1 snapshot 본문과 같은 모양이다. */
const widgetDaySnapshotSchema = z.object({
  /** data: 그날 할 일 있음 · empty: 로그인했으나 그날 할 일 없음 · loggedOut: 비로그인 */
  state: z.enum(['data', 'empty', 'loggedOut']),
  /** 이 day가 설명하는 로컬 날짜 (YYYY-MM-DD) — 렌더 시점 오늘 key와 비교한다 */
  date: z.string(),
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
  weekDays: z
    .array(
      z.object({
        date: z.string(),
        weekdayLabel: z.string(),
        dayLabel: z.string(),
        isComplete: z.boolean(),
        hasTodos: z.boolean(),
      }),
    )
    .length(7)
    .optional(),
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
    weekTitle: z.string().optional(),
    weekRangeLabel: z.string().optional(),
    addTodoLabel: z.string().optional(),
    openTodoLabel: z.string().optional(),
  }),
});

/**
 * v2: 오늘과 (받을 수 있으면) 내일 요약을 함께 저장한다. 자정이 지나면 렌더러가 내일 day를
 * 오늘로 고르므로 앱을 열기 전에도 새 날짜를 표시한다. 저장 key는 v1과 같다.
 */
export const widgetSnapshotSchema = z.object({
  version: z.literal(2),
  updatedAtIso: z.string(),
  days: z.union([
    z.tuple([widgetDaySnapshotSchema]),
    z.tuple([widgetDaySnapshotSchema, widgetDaySnapshotSchema]),
  ]),
});

const legacyWidgetSnapshotV1Schema = widgetDaySnapshotSchema.extend({
  version: z.literal(1),
  updatedAtIso: z.string(),
});

/** 저장소에서 읽을 때만 사용한다. 이미 저장된 v1은 하루짜리 v2로 읽는다. */
export const storedWidgetSnapshotSchema = z.union([
  widgetSnapshotSchema,
  legacyWidgetSnapshotV1Schema.transform((legacy): WidgetSnapshot => ({
    version: 2,
    updatedAtIso: legacy.updatedAtIso,
    days: [omit(legacy, ['version', 'updatedAtIso'])],
  })),
]);

export type WidgetSnapshot = z.infer<typeof widgetSnapshotSchema>;
export type WidgetDaySnapshot = z.infer<typeof widgetDaySnapshotSchema>;
export type WidgetSnapshotStrings = WidgetDaySnapshot['strings'];

/** 위젯 렌더 시점의 표시 상태 — 스냅샷 상태에 자정 경과(stale)를 더한 판정 결과 */
export const widgetRenderStateSchema = z.enum(['data', 'empty', 'loggedOut', 'stale']);
export type WidgetRenderState = z.infer<typeof widgetRenderStateSchema>;

export function isWidgetSnapshotLoggedOut(snapshot: WidgetSnapshot): boolean {
  return snapshot.days[0].state === 'loggedOut';
}

export interface WidgetDaySelection {
  day: WidgetDaySnapshot;
  renderState: WidgetRenderState;
}

/** 렌더 시점의 오늘 key와 같은 day를 고른다. 없으면 날짜가 지난 것으로 보고 stale을 표시한다. */
export function selectWidgetDay(
  snapshot: WidgetSnapshot,
  todayLocalDate: string,
): WidgetDaySelection {
  const [firstDay] = snapshot.days;
  if (isWidgetSnapshotLoggedOut(snapshot)) {
    return { day: firstDay, renderState: 'loggedOut' };
  }

  const today = snapshot.days.find((day) => day.date === todayLocalDate);
  if (today == null) {
    return { day: firstDay, renderState: 'stale' };
  }
  return { day: today, renderState: today.state };
}

/** 소유자를 모르는 개인 목록은 추측해 보여주지 않고 stale로 표시한다. */
export function selectWidgetDayForOwner(
  snapshot: WidgetSnapshot,
  todayLocalDate: string,
  ownerId: string | null,
): WidgetDaySelection {
  if (ownerId == null && !isWidgetSnapshotLoggedOut(snapshot)) {
    return { day: snapshot.days[0], renderState: 'stale' };
  }
  return selectWidgetDay(snapshot, todayLocalDate);
}

export const WidgetSnapshotPolicy = {
  isLoggedOut: isWidgetSnapshotLoggedOut,
  selectDay: selectWidgetDay,
  selectDayForOwner: selectWidgetDayForOwner,
} as const;
