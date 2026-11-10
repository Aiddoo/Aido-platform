import { ACTION_PLAN_LIMITS, MEMO_LIMITS, TODO_ITEM_LIMITS } from "@aido/api/vocabulary";
import { uniq, uniqBy } from "es-toolkit";

import { truncateGraphemes } from "#api/shared/domain/utils/grapheme.util";

import { removeInvisibleCharacters } from "../../generation/application/messages/untrusted-input.messages.js";
import { cleanTitle } from "../../parsing/application/todo-draft.mapper.js";
import type { RepeatPattern } from "../../shared/domain/todo-draft.constants.js";
import type {
  ActionPlanWarning,
  MemoActionDraft,
  NormalizedActionPlan,
  NormalizedVoiceNoteDigest,
  PlannedMemoDraft,
  PlannedTodoDraft,
  QuickPlanDraft,
  TodoActionDraft,
  VoiceNoteDigestDraft,
} from "../domain/action-plan-draft.constants.js";

export interface ActionPlanNormalizeContext {
  /** 사용자가 가진 카테고리 id. 목록에 없는 id는 null(앱이 현재 카테고리를 쓴다)로 바꾼다. */
  readonly ownedCategoryIds: ReadonlySet<number>;
  /** 프롬프트에 준 다가오는 할 일 id. 겹침 표시는 이 안의 id만 남긴다. */
  readonly upcomingTodoIds: ReadonlySet<number>;
}

export interface VoiceNoteDigestNormalizeContext extends ActionPlanNormalizeContext {
  /** 프롬프트에 준 번호 붙인 문장 수. 범위 밖 문장 번호는 null로 바꾼다. */
  readonly sentenceCount: number;
}

/** 하루짜리 회차로 반복되는 표현. 이 경우 기간(endDate)을 쓰지 않는다. */
const NON_REPEATING_PATTERNS: ReadonlySet<RepeatPattern> = new Set(["NONE", "UNSUPPORTED"]);

function cleanText(value: string, maxLength: number): string {
  return truncateGraphemes(removeInvisibleCharacters(value).trim(), maxLength);
}

function normalizeTodo(
  action: TodoActionDraft,
  title: string,
  context: ActionPlanNormalizeContext,
  warnings: ActionPlanWarning[],
): PlannedTodoDraft {
  const categoryId =
    action.categoryId != null && context.ownedCategoryIds.has(action.categoryId)
      ? action.categoryId
      : null;
  if (action.categoryId != null && categoryId == null) {
    warnings.push("UNKNOWN_CATEGORY");
  }
  const duplicateOfTodoId =
    action.duplicateOfTodoId != null && context.upcomingTodoIds.has(action.duplicateOfTodoId)
      ? action.duplicateOfTodoId
      : null;
  if (action.duplicateOfTodoId != null && duplicateOfTodoId == null) {
    warnings.push("UNKNOWN_DUPLICATE");
  }
  const repeats = !NON_REPEATING_PATTERNS.has(action.repeat.pattern);
  if (repeats && action.endDate != null && action.endDate.kind !== "NONE") {
    warnings.push("REPEAT_WITH_END_DATE");
  }
  const items = uniq(action.items.map(cleanTitle)).filter((item) => item !== "" && item !== title);
  if (items.length > TODO_ITEM_LIMITS.MAX_PER_TODO) {
    warnings.push("ITEMS_TRUNCATED");
  }
  return {
    title,
    categoryId,
    schedule: {
      date: action.date,
      endDate: repeats ? null : action.endDate,
      time: action.time,
      repeat: action.repeat,
    },
    visibility: action.visibility,
    items: items.slice(0, TODO_ITEM_LIMITS.MAX_PER_TODO),
    duplicateOfTodoId,
  };
}

function normalizeMemo(action: MemoActionDraft): PlannedMemoDraft | null {
  const content = cleanText(action.content, MEMO_LIMITS.MAX_CONTENT_LENGTH);
  if (content === "") {
    return null;
  }
  const title = cleanTitle(action.title);
  return { title: title === "" ? cleanTitle(content.split("\n")[0] ?? "") : title, content };
}

/**
 * 모델이 낸 계획을 적용 가능한 초안으로 맞춘다. 할 일은 말한 순서대로 앞의 ACTION_PLAN_LIMITS.MAX_TODOS개만
 * 두고, 내용이 빈 메모는 버린다. 모르는 카테고리·겹침 id는 null로 바꾸고, 반복이면 기간을 버린다.
 * 빈 계획은 호출부가 차감하지 않고 환불한다.
 */
export function normalizeActionPlan(
  draft: QuickPlanDraft,
  context: ActionPlanNormalizeContext,
): NormalizedActionPlan {
  const warnings: ActionPlanWarning[] = [];
  const titled = draft.todos.map((action) => ({
    action,
    title: cleanTitle(action.title),
  }));
  const todoActions = titled.filter(({ title }) => title !== "");
  if (todoActions.length < titled.length) {
    warnings.push("EMPTY_TITLE");
  }
  if (todoActions.length > ACTION_PLAN_LIMITS.MAX_TODOS) {
    warnings.push("TODOS_TRUNCATED");
  }
  const todos = todoActions
    .slice(0, ACTION_PLAN_LIMITS.MAX_TODOS)
    .map(({ action, title }) => normalizeTodo(action, title, context, warnings));
  return {
    todos,
    memo: draft.memo == null ? null : normalizeMemo(draft.memo),
    omittedTodoCount: Math.max(todoActions.length - ACTION_PLAN_LIMITS.MAX_TODOS, 0),
    warnings,
  };
}

export function isEmptyActionPlan(plan: NormalizedActionPlan): boolean {
  return plan.todos.length === 0 && plan.memo == null;
}

/**
 * 녹음 정리 초안. 제목·요약·핵심 포인트는 길이·개수 상한으로 자르고, 핵심 포인트의 문장 번호는
 * 준 문장 범위 안의 정수만 남긴다(모델이 시각을 지어내지 않게 서버가 번호로 시각을 찾는다).
 */
export function normalizeVoiceNoteDigest(
  draft: VoiceNoteDigestDraft,
  context: VoiceNoteDigestNormalizeContext,
): NormalizedVoiceNoteDigest {
  const keyPoints = uniqBy(
    draft.keyPoints
      .map((point) => ({
        text: cleanText(point.text, ACTION_PLAN_LIMITS.DIGEST_KEY_POINT_MAX_LENGTH),
        sentenceIndex:
          point.sentenceIndex != null &&
          Number.isInteger(point.sentenceIndex) &&
          point.sentenceIndex >= 0 &&
          point.sentenceIndex < context.sentenceCount
            ? point.sentenceIndex
            : null,
      }))
      .filter((point) => point.text !== ""),
    (point) => point.text,
  ).slice(0, ACTION_PLAN_LIMITS.DIGEST_MAX_KEY_POINTS);
  return {
    title: cleanText(draft.title, ACTION_PLAN_LIMITS.DIGEST_TITLE_MAX_LENGTH).replace(/\s+/g, " "),
    summary: cleanText(draft.summary, ACTION_PLAN_LIMITS.DIGEST_SUMMARY_MAX_LENGTH),
    keyPoints,
    plan: normalizeActionPlan(draft, context),
  };
}

/** 정리할 내용과 계획이 모두 없으면 사용량을 차감하지 않는다. */
export function isEmptyVoiceNoteDigest(digest: NormalizedVoiceNoteDigest): boolean {
  return digest.summary === "" && digest.keyPoints.length === 0 && isEmptyActionPlan(digest.plan);
}
