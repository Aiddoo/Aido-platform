import {
  createCommentRecordFixture,
  createViewerContextFixture,
  ENGAGEMENT_OWNER_ID,
} from "#test/fixtures/engagement-comment.fixture";

import { toTodoCommentView } from "./todo-comment.presenter.js";

const BLOCKED_AUTHOR_ID = "cmblocked0000000000000001";
const COMMENT_ID = "cm1rootcomment000000000001";

describe("toTodoCommentView — v1·v2 공통 댓글 표현", () => {
  it("차단 관계인 작성자의 글은 작성자·내용·좋아요 수를 지우고 상호작용을 막는다", () => {
    // Given
    const record = createCommentRecordFixture({
      authorId: BLOCKED_AUTHOR_ID,
      authorName: "차단한 사람",
      content: "보이면 안 되는 내용",
      likeCount: 3,
    });

    // When
    const view = toTodoCommentView(
      record,
      createViewerContextFixture({
        likedCommentIds: new Set([record.id]),
        blockedAuthorIds: new Set([BLOCKED_AUTHOR_ID]),
      }),
    );

    // Then
    expect(view).toMatchObject({
      author: null,
      content: null,
      isDeleted: true,
      isAuthorBlocked: true,
      likeCount: 0,
      viewer: { isLiked: false, canReply: false, canEdit: false, canDelete: false },
    });
  });

  it("차단 관계인 사람에게 단 답글은 보이지만 @대상 이름을 가린다", () => {
    // Given
    const record = createCommentRecordFixture({
      id: "cm1replycomment00000000001",
      threadCommentId: COMMENT_ID,
      replyToCommentId: COMMENT_ID,
      replyToAuthorId: BLOCKED_AUTHOR_ID,
      replyToAuthorName: "차단한 사람",
      authorId: ENGAGEMENT_OWNER_ID,
    });

    // When
    const view = toTodoCommentView(
      record,
      createViewerContextFixture({ blockedAuthorIds: new Set([BLOCKED_AUTHOR_ID]) }),
    );

    // Then
    expect(view).toMatchObject({
      isDeleted: false,
      isAuthorBlocked: false,
      threadCommentId: COMMENT_ID,
      replyTo: { commentId: COMMENT_ID, authorName: null },
    });
  });
});
