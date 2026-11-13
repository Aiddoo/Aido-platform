import {
  createTodoCommentReadModelFixture as createCommentRecordFixture,
  createTodoCommentViewerFixture as createViewerContextFixture,
  TODO_COMMENT_FIXTURE_OWNER_ID as ENGAGEMENT_OWNER_ID,
} from "#test/fixtures/engagement/todo-comment.fixture";

import { toTodoCommentThreadsResponse, toTodoCommentV2 } from "./todo-comment-response.mapper.js";

const BLOCKED_AUTHOR_ID = "cmblocked0000000000000001";
const COMMENT_ID = "cm1rootcomment000000000001";

describe("toTodoCommentV2 — v1·v2 공통 댓글 표현", () => {
  it("차단 관계인 작성자의 글은 작성자·내용·좋아요 수를 지우고 상호작용을 막는다", () => {
    // Given
    const record = createCommentRecordFixture({
      authorId: BLOCKED_AUTHOR_ID,
      authorName: "차단한 사람",
      content: "보이면 안 되는 내용",
      likeCount: 3,
    });

    // When
    const v2Comment = toTodoCommentV2(
      record,
      createViewerContextFixture({
        likedCommentIds: new Set([record.id]),
        blockedAuthorIds: new Set([BLOCKED_AUTHOR_ID]),
      }),
    );

    // Then
    expect(v2Comment).toMatchObject({
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
    const v2Comment = toTodoCommentV2(
      record,
      createViewerContextFixture({ blockedAuthorIds: new Set([BLOCKED_AUTHOR_ID]) }),
    );

    // Then
    expect(v2Comment).toMatchObject({
      isDeleted: false,
      isAuthorBlocked: false,
      threadCommentId: COMMENT_ID,
      replyTo: { commentId: COMMENT_ID, authorName: null },
    });
  });
});

describe("toTodoCommentThreadsResponse", () => {
  it("차단 관계인 작성자의 답글은 대표 답글로 내보내지 않고 참여자에서도 뺀다", () => {
    // Given
    const comment = createCommentRecordFixture({ id: COMMENT_ID, replyCount: 2 });
    const blockedReply = createCommentRecordFixture({
      id: "cm1blockedreply0000000001",
      authorId: BLOCKED_AUTHOR_ID,
      threadCommentId: COMMENT_ID,
      replyToCommentId: COMMENT_ID,
    });

    // When
    const response = toTodoCommentThreadsResponse({
      items: [
        {
          comment: { ...comment, threadPosition: { rootLikeCount: 0, rootReplyCount: 2 } },
          previewReply: blockedReply,
          totalCount: 2,
          participantAuthors: [
            {
              id: BLOCKED_AUTHOR_ID,
              name: "차단",
              userTag: null,
              profileImage: null,
              isTodoOwner: false,
            },
          ],
        },
      ],
      viewer: createViewerContextFixture({ blockedAuthorIds: new Set([BLOCKED_AUTHOR_ID]) }),
      pagination: {
        previousCursor: null,
        nextCursor: null,
        hasPrevious: false,
        hasNext: false,
        size: 30,
      },
      anchor: null,
    });

    // Then
    expect(response.items[0]).toMatchObject({
      previewReply: null,
      replySummary: { totalCount: 2, hiddenCount: 2, participantAuthors: [] },
    });
  });
});
