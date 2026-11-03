import type { TodoConversationConnection, TodoConversationItem } from "@aido/api";

import type {
  TodoCommentRecord,
  TodoCommentViewerContext,
} from "../../../models/comments/todo-comment.types.js";
import { toTodoCommentResponse } from "./todo-comment.presenter.js";

function toVisualDepth(record: TodoCommentRecord): 0 | 1 {
  return record.threadCommentId == null ? 0 : 1;
}

/**
 * 1.14.0 이하 앱은 이 topology를 그대로 그린다. 묶음은 2단계라 lane은 묶음 머리의 0 하나뿐이고,
 * 다음 행이 같은 묶음의 답글이면 lane이 이어진다.
 */
function toConversationConnection(
  record: TodoCommentRecord,
  nextRecord: TodoCommentRecord | null | undefined,
): TodoConversationConnection {
  const visualDepth = toVisualDepth(record);
  const threadCommentId = record.threadCommentId ?? record.id;
  const continuesThread = nextRecord?.threadCommentId === threadCommentId;

  return {
    visualDepth,
    upperLaneDepths: visualDepth === 0 ? [] : [0],
    lowerLaneDepths: continuesThread ? [0] : [],
    incomingBranch: visualDepth === 0 ? null : { fromDepth: 0, toDepth: 1 },
  };
}

export function toTodoConversationItems(input: {
  records: readonly TodoCommentRecord[];
  nextRecord: TodoCommentRecord | null;
  focusCommentId: string | null;
  viewer: TodoCommentViewerContext;
}): TodoConversationItem[] {
  return input.records.map((record, index) => ({
    comment: toTodoCommentResponse(record, input.viewer),
    connection: toConversationConnection(
      record,
      index === input.records.length - 1 ? input.nextRecord : input.records[index + 1],
    ),
    isFocused: record.id === input.focusCommentId,
  }));
}

/** focus 답글 앞에 따로 싣는 묶음 머리. 아래 lane만 열어 focus 쪽으로 이어진다. */
export function toTodoConversationAncestorItems(input: {
  records: readonly TodoCommentRecord[];
  viewer: TodoCommentViewerContext;
}): TodoConversationItem[] {
  return input.records.map((record) => ({
    comment: toTodoCommentResponse(record, input.viewer),
    connection: {
      visualDepth: 0,
      upperLaneDepths: [],
      lowerLaneDepths: [0],
      incomingBranch: null,
    },
    isFocused: false,
  }));
}
