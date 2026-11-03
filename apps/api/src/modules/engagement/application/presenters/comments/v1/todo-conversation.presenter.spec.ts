import { todoConversationItemSchema } from "@aido/api";

import { createViewerContextFixture } from "#test/fixtures/engagement-comment.fixture";

import type { TodoCommentRecord } from "../../../models/comments/todo-comment.types.js";
import {
  toTodoConversationAncestorItems,
  toTodoConversationItems,
} from "./todo-conversation.presenter.js";

const VIEWER_ID = "cmviewer00000000000000001";
const COMMENT_ID = "cm1todoacomment00000000001";
const OTHER_COMMENT_ID = "cm1todoacomment00000000009";

function createRecord(
  id: string,
  placement: { threadCommentId: string; replyToCommentId: string } | null = null,
): TodoCommentRecord {
  return {
    id,
    todoId: 1,
    threadCommentId: placement?.threadCommentId ?? null,
    replyToCommentId: placement?.replyToCommentId ?? null,
    replyToAuthorId: placement == null ? null : "cm1author0000000000000002",
    replyToAuthorName: placement == null ? null : "대상",
    authorId: "cm1author0000000000000001",
    authorName: "작성자",
    authorUserTag: null,
    authorProfileImage: null,
    todoOwnerId: "cm1owner00000000000000001",
    content: id,
    likeCount: 0,
    replyCount: 0,
    deletedAt: null,
    editedAt: null,
    createdAt: "2026-08-26T00:00:00.000Z",
  };
}

function toItems(records: TodoCommentRecord[], nextRecord: TodoCommentRecord | null = null) {
  return toTodoConversationItems({
    records,
    nextRecord,
    focusCommentId: null,
    viewer: createViewerContextFixture({ viewerId: VIEWER_ID }),
  });
}

describe("할 일 대화 응답 변환 (1.14.0 이하 앱)", () => {
  it("묶음 머리 lane이 마지막 답글까지 이어지고 답글마다 0→1 branch를 그린다", () => {
    // Given
    const comment = createRecord(COMMENT_ID);
    const firstReply = createRecord("cm1todoacomment00000000002", {
      threadCommentId: COMMENT_ID,
      replyToCommentId: COMMENT_ID,
    });
    const replyToReply = createRecord("cm1todoacomment00000000003", {
      threadCommentId: COMMENT_ID,
      replyToCommentId: firstReply.id,
    });
    const nextComment = createRecord(OTHER_COMMENT_ID);

    // When
    const items = toItems([comment, firstReply, replyToReply, nextComment]);

    // Then
    expect(items.map((item) => item.connection)).toEqual([
      { visualDepth: 0, upperLaneDepths: [], lowerLaneDepths: [0], incomingBranch: null },
      {
        visualDepth: 1,
        upperLaneDepths: [0],
        lowerLaneDepths: [0],
        incomingBranch: { fromDepth: 0, toDepth: 1 },
      },
      {
        visualDepth: 1,
        upperLaneDepths: [0],
        lowerLaneDepths: [],
        incomingBranch: { fromDepth: 0, toDepth: 1 },
      },
      { visualDepth: 0, upperLaneDepths: [], lowerLaneDepths: [], incomingBranch: null },
    ]);
    expect(items.map((item) => item.comment.depth)).toEqual([0, 1, 1, 0]);
    expect(items[2]?.comment).toMatchObject({
      parentId: COMMENT_ID,
      threadId: COMMENT_ID,
      replyTo: { commentId: firstReply.id, authorName: "대상" },
    });
    expect(items.every((item) => todoConversationItemSchema.safeParse(item).success)).toBe(true);
  });

  it("페이지 마지막 행도 경계 밖 다음 행이 같은 묶음이면 lane을 잇는다", () => {
    // Given
    const comment = createRecord(COMMENT_ID);
    const reply = createRecord("cm1todoacomment00000000002", {
      threadCommentId: COMMENT_ID,
      replyToCommentId: COMMENT_ID,
    });

    // When
    const [item] = toItems([comment], reply);

    // Then
    expect(item?.connection.lowerLaneDepths).toEqual([0]);
  });

  it("focus 앞에 따로 싣는 묶음 머리는 아래 lane만 연다", () => {
    // Given
    const comment = createRecord(COMMENT_ID);

    // When
    const items = toTodoConversationAncestorItems({
      records: [comment],
      viewer: createViewerContextFixture({ viewerId: VIEWER_ID }),
    });

    // Then
    expect(items.map((item) => item.connection)).toEqual([
      { visualDepth: 0, upperLaneDepths: [], lowerLaneDepths: [0], incomingBranch: null },
    ]);
  });
});
