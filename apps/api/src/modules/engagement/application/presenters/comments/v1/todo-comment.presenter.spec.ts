import {
  createCommentRecordFixture,
  createViewerContextFixture,
} from "#test/fixtures/engagement-comment.fixture";

import { toTodoCommentResponse } from "./todo-comment.presenter.js";

const COMMENT_ID = "cm1rootcomment000000000001";
const REPLY_ID = "cm1replycomment00000000001";

describe("toTodoCommentResponse — 1.14.0 이하 앱 댓글 모양", () => {
  it("답글에 단 답글도 parentId는 묶음 머리, depth는 1이고 @대상은 replyTo에 남긴다", () => {
    // Given
    const record = createCommentRecordFixture({
      id: "cm1nestedreply00000000001",
      threadCommentId: COMMENT_ID,
      replyToCommentId: REPLY_ID,
      replyToAuthorName: "답글 작성자",
    });

    // When
    const response = toTodoCommentResponse(record, createViewerContextFixture());

    // Then
    expect(response).toMatchObject({
      threadId: COMMENT_ID,
      parentId: COMMENT_ID,
      depth: 1,
      replyTo: { commentId: REPLY_ID, authorName: "답글 작성자" },
    });
  });

  it("작성자 Aido ID가 없으면 v1 계약대로 userTag 키를 비운다", () => {
    // Given
    const record = createCommentRecordFixture({ authorUserTag: null });

    // When
    const response = toTodoCommentResponse(record, createViewerContextFixture());

    // Then
    expect(response).toMatchObject({ threadId: record.id, parentId: null, depth: 0 });
    expect(response.author?.userTag).toBeUndefined();
  });
});
