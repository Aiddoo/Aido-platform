import type { TodoConversationPageMode } from "../../application/todo-comment-page.constants.js";

const TODO_COMMENT_ROW_MARKERS = ["PAGE", "PREVIOUS", "NEXT", "BEFORE", "FOCUS", "AFTER"] as const;
type TodoCommentRowMarker = (typeof TODO_COMMENT_ROW_MARKERS)[number];

const ANCHOR_MARKERS = {
  INITIAL: "PAGE",
  AFTER: "PREVIOUS",
  BEFORE: "NEXT",
  FOCUS: "FOCUS",
} as const satisfies Record<TodoConversationPageMode, TodoCommentRowMarker>;

interface MarkedTodoCommentRow<T> {
  marker: TodoCommentRowMarker;
  record: T;
}

interface TodoCommentKeysetWindow<T> {
  items: T[];
  anchorIndex: number | null;
  previousRecord: T | null;
  nextRecord: T | null;
  hasPrevious: boolean;
  hasNext: boolean;
}

function recordsOf<T>(rows: readonly MarkedTodoCommentRow<T>[], marker: TodoCommentRowMarker): T[] {
  return rows.filter((row) => row.marker === marker).map((row) => row.record);
}

/** 기준 행 앞뒤를 size만큼 채운다. 한쪽이 모자라면 반대쪽에서 당겨 채운다. */
function toFocusWindow<T>(
  rows: readonly MarkedTodoCommentRow<T>[],
  size: number,
): TodoCommentKeysetWindow<T> {
  const before = recordsOf(rows, "BEFORE");
  const after = recordsOf(rows, "AFTER");
  const focus = rows.find((row) => row.marker === "FOCUS")?.record;
  if (focus == null) {
    return {
      items: [],
      anchorIndex: null,
      previousRecord: null,
      nextRecord: null,
      hasPrevious: false,
      hasNext: false,
    };
  }

  const desiredBefore = Math.floor(size / 2);
  let beforeCount = Math.min(desiredBefore, before.length);
  let afterCount = Math.min(size - beforeCount - 1, after.length);
  beforeCount = Math.min(before.length, beforeCount + (size - beforeCount - afterCount - 1));
  afterCount = Math.min(after.length, size - beforeCount - 1);
  const selectedBefore = beforeCount === 0 ? [] : before.slice(-beforeCount);

  return {
    items: [...selectedBefore, focus, ...after.slice(0, afterCount)],
    anchorIndex: selectedBefore.length,
    previousRecord: before.at(-beforeCount - 1) ?? null,
    nextRecord: after[afterCount] ?? null,
    hasPrevious: before.length > beforeCount,
    hasNext: after.length > afterCount,
  };
}

/**
 * 경계 행을 한 행 더 읽은 결과를 페이지로 자른다. BEFORE·AFTER는 cursor 행을 기준으로,
 * FOCUS는 기준 행 하나와 앞뒤 BEFORE·AFTER 행으로 창을 만든다.
 */
function toKeysetWindow<T>(
  rows: readonly MarkedTodoCommentRow<T>[],
  mode: TodoConversationPageMode,
  size: number,
): TodoCommentKeysetWindow<T> {
  if (mode === "FOCUS") {
    return toFocusWindow(rows, size);
  }

  const pageCandidates = recordsOf(rows, "PAGE");
  if (mode === "BEFORE") {
    const hasPrevious = pageCandidates.length > size;
    const items = hasPrevious ? pageCandidates.slice(-size) : pageCandidates;
    return {
      items,
      anchorIndex: null,
      previousRecord: hasPrevious ? (pageCandidates.at(-size - 1) ?? null) : null,
      nextRecord: recordsOf(rows, "NEXT").at(0) ?? null,
      hasPrevious: items.length > 0 && hasPrevious,
      hasNext: items.length > 0,
    };
  }

  const hasNext = pageCandidates.length > size;
  const items = hasNext ? pageCandidates.slice(0, size) : pageCandidates;
  return {
    items,
    anchorIndex: null,
    previousRecord: mode === "AFTER" ? (recordsOf(rows, "PREVIOUS").at(0) ?? null) : null,
    nextRecord: hasNext ? (pageCandidates[size] ?? null) : null,
    hasPrevious: items.length > 0 && mode === "AFTER",
    hasNext: items.length > 0 && hasNext,
  };
}

/**
 * 기준 행 앞뒤를 한 문장으로 읽은 행에 자리를 붙인다. 결과는 표시 순서로 정렬되어 있어
 * 기준 행보다 앞이면 BEFORE, 뒤면 AFTER다. 다음·이전 페이지에서는 기준 행이 경계(PREVIOUS·NEXT)다.
 */
function markRows<T extends { readonly id: string }>(
  items: readonly T[],
  mode: TodoConversationPageMode,
  anchorId: string | undefined,
): MarkedTodoCommentRow<T>[] {
  const anchorIndex = items.findIndex((item) => item.id === anchorId);
  return items.map((item, index): MarkedTodoCommentRow<T> => {
    if (index === anchorIndex) {
      return { marker: ANCHOR_MARKERS[mode], record: item };
    }
    if (mode === "FOCUS") {
      return { marker: index < anchorIndex ? "BEFORE" : "AFTER", record: item };
    }
    return { marker: "PAGE", record: item };
  });
}

export function toTodoCommentKeysetWindow<T extends { readonly id: string }>(params: {
  readonly items: readonly T[];
  readonly mode: TodoConversationPageMode;
  readonly anchorId: string | undefined;
  readonly size: number;
}): TodoCommentKeysetWindow<T> {
  return toKeysetWindow(
    markRows(params.items, params.mode, params.anchorId),
    params.mode,
    params.size,
  );
}
