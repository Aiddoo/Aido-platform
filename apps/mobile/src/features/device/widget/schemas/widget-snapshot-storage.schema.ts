import { SUPPORTED_LOCALES } from '@aido/api/vocabulary';
import { dateKeySchema } from '@src/shared/date/date-key';
import { omit } from 'es-toolkit';
import { z } from 'zod';

import { WIDGET_TOP_TODOS_LIMIT } from '../constants/widget.constants';
import { widgetRenderStateSchema } from '../domains/widget-snapshot.model';

// Persist only display data; isolated widget runtimes cannot access auth or i18n.
/** 하루치 표시 데이터. v1 snapshot 본문과 같은 모양이다. */
const widgetDaySnapshotSchema = z.object({
  /** data: 그날 할 일 있음 · empty: 로그인했으나 그날 할 일 없음 · loggedOut: 비로그인 */
  state: widgetRenderStateSchema.exclude(['stale']),
  /** 이 day가 설명하는 로컬 날짜 (YYYY-MM-DD) — 렌더 시점 오늘 key와 비교한다 */
  date: dateKeySchema,
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
        /** HEX. 위젯 체크박스를 앱 홈과 같은 색으로 그린다 */
        categoryColor: z.string(),
      }),
    )
    .max(WIDGET_TOP_TODOS_LIMIT),
  locale: z.enum(SUPPORTED_LOCALES),
  weekDays: z
    .array(
      z.object({
        date: dateKeySchema,
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

/** 내일 day를 함께 저장해 자정이 지나면 앱을 열기 전에도 새 날짜를 보인다. 저장 key는 v1과 같다 */
const widgetSnapshotSchema = z.object({
  version: z.literal(2),
  updatedAtIso: z.string(),
  days: z.union([
    z.tuple([widgetDaySnapshotSchema]),
    z.tuple([widgetDaySnapshotSchema, widgetDaySnapshotSchema]),
  ]),
});

export type WidgetSnapshot = z.infer<typeof widgetSnapshotSchema>;
export type WidgetDaySnapshot = z.infer<typeof widgetDaySnapshotSchema>;
export type WidgetSnapshotStrings = WidgetDaySnapshot['strings'];

const legacyWidgetSnapshotV1Schema = widgetDaySnapshotSchema.extend({
  version: z.literal(1),
  updatedAtIso: z.string(),
});

/** 저장소에서 읽을 때만 사용한다. 이미 저장된 v1은 하루짜리 v2로 읽는다. */
export const widgetSnapshotStorageSchema = z.union([
  widgetSnapshotSchema,
  legacyWidgetSnapshotV1Schema.transform((legacy): WidgetSnapshot => ({
    version: 2,
    updatedAtIso: legacy.updatedAtIso,
    days: [omit(legacy, ['version', 'updatedAtIso'])],
  })),
]);
