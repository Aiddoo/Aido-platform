import {
  type ParsedMemoData,
  parsedMemoDataSchema,
  type ParsedTodoData,
  parsedTodoDataSchema,
} from "@aido/api";

import type { SupportedLocale } from "#api/shared/domain/locale";
import { truncateGraphemes } from "#api/shared/domain/utils/grapheme.util";

import { resolveTodoSchedule } from "../../../domain/services/parsing/resolve-todo-schedule.js";
import type { TodoDraft } from "../../../domain/types/parsing/todo-draft.types.js";

/** 공개 계약의 제목·항목 상한 */
const TITLE_MAX_LENGTH = 200;
const MEMO_MAX_TODOS = 5;
const MEMO_MAX_ITEMS = 5;
const MERGED_ITEM_SEPARATOR = " · ";

/** 모델 대상 명령만 있는 입력에 앱 언어로 보여 줄 제목 */
export const NO_ACTION_TITLE: Readonly<Record<SupportedLocale, string>> = {
  ko: "입력 확인 필요",
  en: "Needs review",
};

export type NormalizationWarning =
  | "TITLE_FALLBACK"
  | "TODOS_TRUNCATED"
  | "ITEMS_MERGED"
  | "INVALID_DATE"
  | "INVALID_TIME"
  | "END_BEFORE_START"
  | "UNSUPPORTED_RECURRENCE"
  | "EMPTY_RECURRENCE";

export interface DraftNormalizeContext {
  readonly now: Date;
  readonly timezone: string;
  readonly locale: SupportedLocale;
  readonly ownedCategoryIds: ReadonlySet<number>;
}

function cleanTitle(value: string): string {
  return truncateGraphemes(value.replace(/\s+/g, " ").trim(), TITLE_MAX_LENGTH);
}

interface NormalizedTodo {
  readonly todo: ParsedTodoData;
  readonly intent: TodoDraft["intent"];
  readonly warnings: readonly NormalizationWarning[];
}

/** draft 하나를 공개 할 일 모양으로 바꾼다. 날짜·시각은 서버 resolver가 정한다. */
export function normalizeTodoDraft(
  draft: TodoDraft,
  context: DraftNormalizeContext & { readonly fallbackTitle: string },
): NormalizedTodo {
  if (draft.intent === "NO_ACTION") {
    const schedule = resolveTodoSchedule(
      { date: { kind: "TODAY" }, time: null, repeat: { pattern: "NONE" } },
      { now: context.now, timeZone: context.timezone },
    );
    return {
      todo: parsedTodoDataSchema.parse({
        title: NO_ACTION_TITLE[context.locale],
        startDate: schedule.startDate,
        endDate: null,
        scheduledTime: null,
        isAllDay: true,
        isRecurring: false,
        recurrence: null,
      }),
      intent: "NO_ACTION",
      warnings: [],
    };
  }

  const warnings: NormalizationWarning[] = [];
  let title = cleanTitle(draft.title);
  if (title === "") {
    title = cleanTitle(context.fallbackTitle) || NO_ACTION_TITLE[context.locale];
    warnings.push("TITLE_FALLBACK");
  }
  const schedule = resolveTodoSchedule(draft, { now: context.now, timeZone: context.timezone });
  warnings.push(...schedule.warnings);
  const categoryId =
    draft.categoryId !== undefined && context.ownedCategoryIds.has(draft.categoryId)
      ? draft.categoryId
      : undefined;
  return {
    todo: parsedTodoDataSchema.parse({
      title,
      startDate: schedule.startDate,
      endDate: schedule.endDate,
      scheduledTime: schedule.scheduledTime,
      isAllDay: schedule.isAllDay,
      isRecurring: schedule.isRecurring,
      recurrence: schedule.recurrence,
      ...(categoryId !== undefined && { categoryId }),
    }),
    intent: "TASK",
    warnings,
  };
}

/** 메모 draft: 앞의 5개 할 일만 입력 순서대로 두고, 항목은 5개로 맞추며, 카테고리를 보정한다. */
export function normalizeMemoDraft(
  todos: readonly (TodoDraft & { readonly items: readonly { readonly title: string }[] })[],
  context: DraftNormalizeContext & {
    readonly fallbackTitle: string;
    readonly defaultCategoryId: number;
  },
): { data: ParsedMemoData; noAction: boolean; warnings: NormalizationWarning[] } {
  const warnings: NormalizationWarning[] = [];
  const tasks = todos.filter((todo) => todo.intent === "TASK");
  if (tasks.length > MEMO_MAX_TODOS) warnings.push("TODOS_TRUNCATED");
  const kept = tasks.slice(0, MEMO_MAX_TODOS);
  const noAction = kept.length === 0;
  const drafts = noAction ? [{ ...noActionDraft(), items: [] }] : kept;

  const parsed = drafts.map((draft) => {
    const normalized = normalizeTodoDraft(draft, context);
    warnings.push(...normalized.warnings);
    const items = normalizeItems(
      draft.items.map((item) => cleanTitle(item.title)),
      normalized.todo.title,
    );
    if (items.merged) warnings.push("ITEMS_MERGED");
    return {
      ...normalized.todo,
      categoryId: normalized.todo.categoryId ?? context.defaultCategoryId,
      items: items.titles.map((itemTitle) => ({ title: itemTitle })),
    };
  });
  return { data: parsedMemoDataSchema.parse({ todos: parsed }), noAction, warnings };
}

function noActionDraft(): TodoDraft {
  return {
    intent: "NO_ACTION",
    title: "",
    date: { kind: "NONE" },
    time: null,
    repeat: { pattern: "NONE" },
  };
}

/** 빈 항목·제목 반복을 빼고, 5개를 넘으면 5번째부터 하나로 잇는다. */
function normalizeItems(
  titles: readonly string[],
  todoTitle: string,
): { titles: string[]; merged: boolean } {
  const usable = titles.filter((title) => title !== "" && title !== todoTitle);
  if (usable.length <= MEMO_MAX_ITEMS) return { titles: usable, merged: false };
  const head = usable.slice(0, MEMO_MAX_ITEMS - 1);
  const tail = cleanTitle(usable.slice(MEMO_MAX_ITEMS - 1).join(MERGED_ITEM_SEPARATOR));
  return { titles: [...head, tail], merged: true };
}
