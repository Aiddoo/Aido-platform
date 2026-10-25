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

/** 모델 대상 명령만 있는 입력에 앱 언어로 보여 줄 제목 */
export const NO_ACTION_TITLE: Readonly<Record<SupportedLocale, string>> = {
  ko: "입력 확인 필요",
  en: "Needs review",
};

export type NormalizationWarning =
  | "TITLE_FALLBACK"
  | "TODOS_TRUNCATED"
  | "ITEMS_TRUNCATED"
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
    // 제목은 null이 아니라 빈 문자열로 비므로 ??가 아니라 빈 문자열 비교로 대체한다.
    const fallbackTitle = cleanTitle(context.fallbackTitle);
    title = fallbackTitle === "" ? NO_ACTION_TITLE[context.locale] : fallbackTitle;
    warnings.push("TITLE_FALLBACK");
  }
  const schedule = resolveTodoSchedule(draft, { now: context.now, timeZone: context.timezone });
  warnings.push(...schedule.warnings);
  const categoryId =
    draft.categoryId != null && context.ownedCategoryIds.has(draft.categoryId)
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
      ...(categoryId != null && { categoryId }),
    }),
    intent: "TASK",
    warnings,
  };
}

/** 모델이 돌려준 메모 draft. totalTaskCount는 모델이 쓰지 않은 할 일까지 센 메모 전체 할 일 수다. */
export interface MemoDraftInput {
  readonly todos: readonly (TodoDraft & {
    readonly items: readonly { readonly title: string }[];
  })[];
  readonly totalTaskCount?: number;
}

/**
 * 메모 draft: 할 일은 합치지 않고 입력 순서대로 앞의 5개만 두며, 만들지 않은 할 일 수를 함께 돌려준다.
 * 출력 토큰을 아끼려고 모델은 할 일을 8개까지만 쓰므로, 남은 수는 모델이 센 전체 수를 우선한다.
 * 모델이 전체 수를 빠뜨리거나 실제로 쓴 것보다 적게 세면 받은 할 일 수로 계산한다.
 */
export function normalizeMemoDraft(
  memo: MemoDraftInput,
  context: DraftNormalizeContext & {
    readonly fallbackTitle: string;
    readonly defaultCategoryId: number;
  },
): {
  data: ParsedMemoData;
  noAction: boolean;
  omittedTodoCount: number;
  warnings: NormalizationWarning[];
} {
  const warnings: NormalizationWarning[] = [];
  const tasks = memo.todos.filter((todo) => todo.intent === "TASK");
  const kept = tasks.slice(0, MEMO_MAX_TODOS);
  const noAction = kept.length === 0;
  const totalTaskCount = noAction ? 0 : Math.max(tasks.length, memo.totalTaskCount ?? 0);
  if (totalTaskCount > MEMO_MAX_TODOS) warnings.push("TODOS_TRUNCATED");
  const drafts = noAction ? [{ ...noActionDraft(), items: [] }] : kept;

  const parsed = drafts.map((draft) => {
    const normalized = normalizeTodoDraft(draft, context);
    warnings.push(...normalized.warnings);
    const items = normalizeItems(
      draft.items.map((item) => cleanTitle(item.title)),
      normalized.todo.title,
    );
    if (items.truncated) warnings.push("ITEMS_TRUNCATED");
    return {
      ...normalized.todo,
      categoryId: normalized.todo.categoryId ?? context.defaultCategoryId,
      items: items.titles.map((itemTitle) => ({ title: itemTitle })),
    };
  });
  return {
    data: parsedMemoDataSchema.parse({ todos: parsed }),
    noAction,
    omittedTodoCount: totalTaskCount - kept.length,
    warnings,
  };
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

/** 빈 항목·제목 반복을 빼고 입력 순서대로 앞의 5개만 둔다. */
function normalizeItems(
  titles: readonly string[],
  todoTitle: string,
): { titles: string[]; truncated: boolean } {
  const usable = titles.filter((title) => title !== "" && title !== todoTitle);
  return { titles: usable.slice(0, MEMO_MAX_ITEMS), truncated: usable.length > MEMO_MAX_ITEMS };
}
