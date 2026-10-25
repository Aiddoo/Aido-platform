import { describe, expect, it } from "vitest";

import {
  createCommentRecordFixture,
  ENGAGEMENT_OWNER_ID,
  ENGAGEMENT_VIEWER_ID,
} from "#test/fixtures/engagement-comment.fixture";

import { toTodoCommentResponse } from "./todo-comment.presenter.js";

const BLOCKED_AUTHOR_ID = "cmblocked0000000000000001";

describe("toTodoCommentResponse — 차단 관계 가리기", () => {
  it("차단 관계인 작성자의 댓글은 작성자·내용·좋아요 수를 지우고 상호작용을 막는다", () => {
    // Given
    const record = createCommentRecordFixture({
      authorId: BLOCKED_AUTHOR_ID,
      authorName: "차단한 사람",
      content: "보이면 안 되는 내용",
      likeCount: 3,
    });

    // When
    const response = toTodoCommentResponse(
      record,
      ENGAGEMENT_VIEWER_ID,
      new Set([record.id]),
      new Set([BLOCKED_AUTHOR_ID]),
    );

    // Then
    expect(response).toMatchObject({
      author: null,
      content: null,
      isDeleted: true,
      isAuthorBlocked: true,
      likeCount: 0,
      viewer: { canReply: false, canEdit: false, canDelete: false },
    });
  });

  it("차단 관계인 사람에게 단 답글은 보이지만 답글 대상 이름을 가린다", () => {
    // Given
    const record = createCommentRecordFixture({
      id: "cm1replycomment00000000001",
      parentId: "cm1rootcomment000000000001",
      rootId: "cm1rootcomment000000000001",
      depth: 1,
      parentAuthorId: BLOCKED_AUTHOR_ID,
      parentAuthorName: "차단한 사람",
      authorId: ENGAGEMENT_OWNER_ID,
    });

    // When
    const response = toTodoCommentResponse(
      record,
      ENGAGEMENT_VIEWER_ID,
      new Set(),
      new Set([BLOCKED_AUTHOR_ID]),
    );

    // Then
    expect(response.isDeleted).toBe(false);
    expect(response.isAuthorBlocked).toBe(false);
    expect(response.replyTo).toEqual({ commentId: record.parentId, authorName: null });
  });
});
