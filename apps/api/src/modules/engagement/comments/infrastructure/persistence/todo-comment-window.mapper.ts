export type TodoCommentRowMarker = "PAGE" | "PREVIOUS" | "NEXT" | "BEFORE" | "FOCUS" | "AFTER";

export interface MarkedTodoCommentRow<T> {
  marker: TodoCommentRowMarker;
  record: T;
}

export interface TodoCommentKeysetWindow<T> {
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
export function toTodoCommentKeysetWindow<T>(
  rows: readonly MarkedTodoCommentRow<T>[],
  mode: "INITIAL" | "BEFORE" | "AFTER" | "FOCUS",
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
