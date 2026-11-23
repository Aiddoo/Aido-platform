import { CommentPlacement } from "./comment-placement.vo.js";
import { TodoCommentId } from "./todo-comment-id.vo.js";

const COMMENT_ID = TodoCommentId.reconstitute("cm1todoacomment00000000001");
const REPLY_ID = TodoCommentId.reconstitute("cm1todoacomment00000000002");
const NESTED_REPLY_ID = TodoCommentId.reconstitute("cm1todoacomment00000000003");

describe("CommentPlacement", () => {
  it("댓글에 답하면 그 댓글이 묶음 머리이자 답글 대상이다", () => {
    // Given
    const target = { id: COMMENT_ID, placement: CommentPlacement.create(null) };

    // When
    const placement = CommentPlacement.create(target);

    // Then
    expect(placement.value).toEqual({
      kind: "REPLY",
      threadCommentId: COMMENT_ID,
      replyToCommentId: COMMENT_ID,
    });
  });

  it("답글에 답하면 같은 묶음에 붙고 답글 대상만 그 답글이다", () => {
    // Given
    const target = {
      id: REPLY_ID,
      placement: CommentPlacement.create({
        id: COMMENT_ID,
        placement: CommentPlacement.create(null),
      }),
    };

    // When
    const placement = CommentPlacement.create(target);

    // Then
    expect(placement.value).toEqual({
      kind: "REPLY",
      threadCommentId: COMMENT_ID,
      replyToCommentId: REPLY_ID,
    });
  });

  it("답글의 답글에 답해도 묶음은 2단계를 넘지 않는다", () => {
    // Given
    const reply = CommentPlacement.create({
      id: COMMENT_ID,
      placement: CommentPlacement.create(null),
    });
    const nestedReply = CommentPlacement.create({ id: REPLY_ID, placement: reply });

    // When
    const placement = CommentPlacement.create({ id: NESTED_REPLY_ID, placement: nestedReply });

    // Then
    expect(placement.value).toEqual({
      kind: "REPLY",
      threadCommentId: COMMENT_ID,
      replyToCommentId: NESTED_REPLY_ID,
    });
  });

  it("저장된 답글 대상이 비면 묶음 머리에 단 답글로 복원한다", () => {
    // When
    const placement = CommentPlacement.reconstitute({
      parentId: COMMENT_ID.value,
      replyToCommentId: null,
    });

    // Then
    expect(placement.value).toEqual({
      kind: "REPLY",
      threadCommentId: COMMENT_ID,
      replyToCommentId: COMMENT_ID,
    });
  });

  it("묶음 머리가 없으면 댓글이다", () => {
    // When
    const placement = CommentPlacement.reconstitute({ parentId: null, replyToCommentId: null });

    // Then
    expect(placement.value).toEqual({
      kind: "COMMENT",
    });
  });
});
