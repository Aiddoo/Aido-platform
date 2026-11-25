import { SUPPORTED_LOCALES } from '@aido/api/vocabulary';
import { dateKeySchema } from '@src/shared/date/date-key';
import { completionRateSchema } from '@src/shared/domains/completion-rate.model';
import { z } from 'zod';

import { WIDGET_TOP_TODOS_LIMIT } from '../constants/widget.constants';
import { widgetSnapshotDaySchema, widgetSnapshotSchema } from '../domains/widget-snapshot.model';

// Persist only display data; isolated widget runtimes cannot access auth or i18n.
// 출시한 위젯이 읽는 저장 모양이다. 칸을 지우거나 이름을 바꾸지 않고, optional은 옛 앱이 쓴 값을 읽으려고 둔다
export const widgetDayStorageSchema = widgetSnapshotDaySchema.extend({
  totalTodos: z.int().min(0),
  completedTodos: z.int().min(0),
  completionRate: completionRateSchema,
  isComplete: z.boolean(),
  currentStreak: z.int().min(0),
  topTodos: z
    .array(
      z.object({
        id: z.int(),
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

/** 키 `aido_widget_snapshot_v1`에 쓰는 v2 JSON. iOS timeline도 같은 모양을 받는다 */
export const widgetSnapshotStorageSchema = widgetSnapshotSchema.extend({
  version: z.literal(2),
  updatedAtIso: z.string(),
  days: z.union([
    z.tuple([widgetDayStorageSchema]),
    z.tuple([widgetDayStorageSchema, widgetDayStorageSchema]),
  ]),
});

export type StoredWidgetSnapshot = z.infer<typeof widgetSnapshotStorageSchema>;
export type StoredWidgetDay = z.infer<typeof widgetDayStorageSchema>;
export type StoredWidgetStrings = StoredWidgetDay['strings'];
