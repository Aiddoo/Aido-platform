// oxlint-disable-next-line no-restricted-imports -- 정리한 결과를 과금 생성 안에서 공개 계약으로 검증해 위반이면 환불한다. ParsedTodo read model로 옮길 때 지운다
import {
  type ParsedMemoData,
  parsedMemoDataSchema,
  type ParsedTodoData,
  parsedTodoDataSchema,
} from "@aido/api";
import { AI_PARSE_LIMITS } from "@aido/api/vocabulary";

import type { SupportedLocale } from "#api/shared/domain/locale";
import { truncateGraphemes } from "#api/shared/domain/utils/grapheme.util";

import { removeInvisibleCharacters } from "../../generation/application/messages/untrusted-input.messages.js";
import {
  type ExistingTodo,
  findDuplicateTodoId,
} from "../../shared/domain/action-plan-dedupe.domain-service.js";
import type {
  DateRef,
  ScheduleDraft,
  TodoDraft,
} from "../../shared/domain/todo-draft.constants.js";
import {
  isSingleWeekendRepeat,
  resolveTodoSchedule,
} from "../../shared/domain/todo-schedule.domain-service.js";

/** 공개 계약의 할 일·하위 할 일·메모 제목 상한 */
export const TITLE_MAX_LENGTH = 200;

/**
 * 모델이 센 메모 전체 할 일 수의 상한. 입력에 심은 지시로 터무니없는 수("나머지 99999개")를
 * 앱에 보이지 않게 한다. 5000자 메모에서 현실적인 할 일 수보다 넉넉하다.
 */
const MEMO_TOTAL_TASK_COUNT_MAX = 100;

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
  | "REPEAT_END_NOT_AFTER_START"
  | "UNSUPPORTED_RECURRENCE"
  | "EMPTY_RECURRENCE"
  | "UNKNOWN_DUPLICATE";

export interface DraftNormalizeContext {
  readonly now: Date;
  readonly timezone: string;
  readonly locale: SupportedLocale;
  readonly ownedCategoryIds: ReadonlySet<number>;
}

/** 보이지 않는 문자·연속 공백을 정리하고 제목 상한으로 자른다. */
export function cleanTitle(value: string): string {
  return truncateGraphemes(
    removeInvisibleCharacters(value).replace(/\s+/g, " ").trim(),
    TITLE_MAX_LENGTH,
  );
}

/** 모델 대상 명령만 있는 입력의 일정: 오늘 하루(시각·반복 없음) */
const NO_ACTION_SCHEDULE: ScheduleDraft = {
  date: {
    kind: "TODAY",
    amount: null,
    weekday: null,
    weekOffset: null,
    month: null,
    day: null,
    year: null,
  },
  endDate: null,
  time: null,
  repeat: { pattern: "NONE", daysOfWeek: null, until: null, forDuration: null },
};

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
    const schedule = resolveTodoSchedule(NO_ACTION_SCHEDULE, {
      now: context.now,
      timeZone: context.timezone,
    });
    return {
      todo: parsedTodoDataSchema.parse({
        title: NO_ACTION_TITLE[context.locale],
        startDate: schedule.startDate,
        endDate: null,
        scheduledTime: null,
        isAllDay: true,
        isRecurring: false,
        recurrence: null,
        repeat: null,
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
      : null;
  return {
    todo: parsedTodoDataSchema.parse({
      title,
      startDate: schedule.startDate,
      endDate: schedule.endDate,
      scheduledTime: schedule.scheduledTime,
      isAllDay: schedule.isAllDay,
      isRecurring: schedule.isRecurring,
      recurrence: schedule.recurrence,
      repeat: schedule.repeat,
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
    readonly duplicateOfTodoId: number | null;
  })[];
  readonly totalTaskCount: number | null;
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
    readonly upcomingTodos: readonly ExistingTodo[];
  },
): {
  parsedMemo: ParsedMemoData;
  hasNoAction: boolean;
  omittedTodoCount: number;
  warnings: NormalizationWarning[];
  dateRefs: Pick<DateRef, "kind" | "weekOffset">[];
} {
  const warnings: NormalizationWarning[] = [];
  const tasks = memo.todos.filter((todo) => todo.intent === "TASK");
  const kept = tasks.slice(0, AI_PARSE_LIMITS.MEMO_MAX_TODOS);
  const hasNoAction = kept.length === 0;
  const totalTaskCount = hasNoAction
    ? 0
    : Math.min(Math.max(tasks.length, memo.totalTaskCount ?? 0), MEMO_TOTAL_TASK_COUNT_MAX);
  if (totalTaskCount > AI_PARSE_LIMITS.MEMO_MAX_TODOS) {
    warnings.push("TODOS_TRUNCATED");
  }
  const drafts = hasNoAction ? [{ ...noActionDraft(), items: [], duplicateOfTodoId: null }] : kept;

  const parsed = drafts.map((draft) => {
    const normalized = normalizeTodoDraft(draft, context);
    warnings.push(...normalized.warnings);
    const todo = withSingleWeekendAsOnce(normalized.todo);
    const items = normalizeItems(
      draft.items.map((item) => cleanTitle(item.title)),
      normalized.todo.title,
    );
    if (items.truncated) {
      warnings.push("ITEMS_TRUNCATED");
    }
    const isKnownDuplicate = context.upcomingTodos.some(({ id }) => id === draft.duplicateOfTodoId);
    if (draft.duplicateOfTodoId != null && !isKnownDuplicate) {
      warnings.push("UNKNOWN_DUPLICATE");
    }
    return {
      ...todo,
      categoryId: todo.categoryId ?? context.defaultCategoryId,
      items: items.titles.map((itemTitle) => ({ title: itemTitle })),
      duplicateOfTodoId: hasNoAction
        ? null
        : findDuplicateTodoId(
            {
              title: normalized.todo.title,
              startDate: normalized.todo.startDate,
              duplicateOfTodoId: isKnownDuplicate ? draft.duplicateOfTodoId : null,
            },
            context.upcomingTodos,
          ),
    };
  });
  return {
    parsedMemo: parsedMemoDataSchema.parse({ todos: parsed }),
    hasNoAction,
    omittedTodoCount: totalTaskCount - kept.length,
    warnings,
    dateRefs: kept.map(({ date: { kind, weekOffset } }) => ({ kind, weekOffset })),
  };
}

/**
 * 메모의 "이번 주말 X"는 새 앱이 읽는 repeat에서 토요일 한 번으로 준다. 출시 앱이 읽는 isRecurring·recurrence는
 * 그대로 두어 출시 앱의 변환 결과(토·일 각 한 번)가 바뀌지 않는다.
 */
function withSingleWeekendAsOnce(todo: ParsedTodoData): ParsedTodoData {
  return todo.repeat != null && isSingleWeekendRepeat(todo.repeat, todo.startDate)
    ? { ...todo, endDate: null, repeat: null }
    : todo;
}

function noActionDraft(): TodoDraft {
  return { intent: "NO_ACTION", title: "", categoryId: null, ...NO_ACTION_SCHEDULE };
}

/** 빈 항목·제목 반복을 빼고 입력 순서대로 앞의 5개만 둔다. */
function normalizeItems(
  titles: readonly string[],
  todoTitle: string,
): { titles: string[]; truncated: boolean } {
  const usable = titles.filter((title) => title !== "" && title !== todoTitle);
  return {
    titles: usable.slice(0, AI_PARSE_LIMITS.MEMO_MAX_ITEMS),
    truncated: usable.length > AI_PARSE_LIMITS.MEMO_MAX_ITEMS,
  };
}
