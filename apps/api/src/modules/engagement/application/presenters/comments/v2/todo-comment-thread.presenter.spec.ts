import {
  createCommentRecordFixture,
  createViewerContextFixture,
} from "#test/fixtures/engagement-comment.fixture";

import { toTodoCommentThreadsResponse } from "./todo-comment-thread.presenter.js";

const COMMENT_ID = "cm1rootcomment000000000001";
const BLOCKED_AUTHOR_ID = "cmblocked0000000000000001";

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
