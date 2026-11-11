import { ErrorCode } from "@aido/api/errors";

import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import {
  createTodoCommentFixture,
  TODO_COMMENT_FIXTURE_NOW,
} from "#test/fixtures/engagement/todo-comment.fixture";

import { CommentPlacement } from "./comment-placement.vo.js";
import { TodoCommentContent } from "./todo-comment-content.vo.js";
import { TodoCommentId } from "./todo-comment-id.vo.js";
import { TodoComment } from "./todo-comment.aggregate.js";

const AUTHOR = UserId.reconstitute("cm1author0000000000000001");
const OWNER = UserId.reconstitute("cm1owner00000000000000001");
const STRANGER = UserId.reconstitute("cm1another000000000000001");
const LATER = TODO_COMMENT_FIXTURE_NOW.add({ hours: 1 });

function createComment(overrides: Parameters<typeof createTodoCommentFixture>[0] = {}) {
  return createTodoCommentFixture({ authorId: AUTHOR.value, content: "함께 해요", ...overrides });
}

describe("TodoComment — 댓글 Aggregate", () => {
  it("새 글은 좋아요·답글 없이 만들고 수정·삭제 시각이 없다", () => {
    // When
    const comment = TodoComment.create({
      id: TodoCommentId.reconstitute("cm1newcomment000000000001"),
      todoId: 1,
      authorId: AUTHOR,
      placement: CommentPlacement.create(null),
      content: TodoCommentContent.create(" 새 글 "),
      clientRequestId: "00000000-0000-4000-8000-000000000001",
      requestFingerprint: "f".repeat(64),
      createdAt: TODO_COMMENT_FIXTURE_NOW,
    });

    // Then
    expect(comment.toPrimitives()).toMatchObject({
      content: "새 글",
      likeCount: 0,
      replyCount: 0,
      deletedAt: null,
      editedAt: null,
      updatedAt: TODO_COMMENT_FIXTURE_NOW,
    });
  });

  it("작성자는 글을 고치고 수정 시각을 남긴다", () => {
    // Given
    const comment = createComment();

    // When
    const isChanged = comment.edit(AUTHOR, "  수정된 댓글  ", LATER);

    // Then
    expect(isChanged).toBe(true);
    expect(comment.content).toBe("수정된 댓글");
    expect(comment.toPrimitives().editedAt).toEqual(LATER);
  });

  it("남의 글은 내용 검증보다 먼저 TODO_0832로 고치지 못하게 하고 원문을 둔다", () => {
    // Given
    const comment = createComment();

    // When
    const editing = () => comment.edit(STRANGER, "   ", LATER);

    // Then
    expect(editing).toThrow(expect.objectContaining({ errorCode: ErrorCode.TODO_0832 }));
    expect(comment.content).toBe("함께 해요");
  });

  it("빈 내용으로 고치면 원문과 수정 시각을 바꾸지 않는다", () => {
    // Given
    const comment = createComment();

    // When
    const editing = () => comment.edit(AUTHOR, "   ", LATER);

    // Then
    expect(editing).toThrow(expect.objectContaining({ errorCode: ErrorCode.SYS_0002 }));
    expect(comment.toPrimitives()).toMatchObject({ content: "함께 해요", editedAt: null });
  });

  it("지우면 원문과 좋아요 수를 비우고 이미 지운 글은 다시 바꾸지 않는다", () => {
    // Given
    const comment = createComment({ likeCount: 2 });

    // When
    const first = comment.markDeleted({ actorId: AUTHOR, todoOwnerId: OWNER, now: LATER });
    const second = comment.markDeleted({
      actorId: AUTHOR,
      todoOwnerId: OWNER,
      now: LATER.add({ hours: 1 }),
    });

    // Then
    expect([first, second]).toEqual([true, false]);
    expect(comment.toPrimitives()).toMatchObject({ content: null, likeCount: 0, deletedAt: LATER });
  });

  it("할 일 주인은 남의 글을 지울 수 있고 다른 사람은 TODO_0832로 막는다", () => {
    // Given
    const byOwner = createComment();
    const byStranger = createComment();

    // When
    const ownerDeleted = byOwner.markDeleted({ actorId: OWNER, todoOwnerId: OWNER, now: LATER });
    const strangerDeleting = () =>
      byStranger.markDeleted({ actorId: STRANGER, todoOwnerId: OWNER, now: LATER });

    // Then
    expect(ownerDeleted).toBe(true);
    expect(strangerDeleting).toThrow(expect.objectContaining({ errorCode: ErrorCode.TODO_0832 }));
  });

  it("지운 글에는 답하거나 좋아요를 누르지 못한다", () => {
    // Given
    const comment = createComment({ deletedAt: LATER });

    // When / Then
    expect(() => comment.placeReply()).toThrow(
      expect.objectContaining({ errorCode: ErrorCode.TODO_0833 }),
    );
    expect(() => comment.addLike(LATER)).toThrow(
      expect.objectContaining({ errorCode: ErrorCode.TODO_0833 }),
    );
  });

  it("댓글은 자기 자신이 묶음 머리이고, 답글에 답한 자리는 같은 묶음에 붙는다", () => {
    // Given
    const head = createComment({ id: "cm1head00000000000000001" });
    const reply = createComment({
      id: "cm1reply0000000000000001",
      parentId: head.id.value,
      replyToCommentId: head.id.value,
    });

    // When
    const placement = reply.placeReply();

    // Then
    expect(head.threadCommentId.equals(head.id)).toBe(true);
    expect({
      thread: placement.threadCommentId,
      replyTo: placement.replyToCommentId,
    }).toEqual({ thread: head.id.value, replyTo: reply.id.value });
  });

  it("묶음 머리만 답글 수를 가지고 0 아래로 내리지 않는다", () => {
    // Given
    const head = createComment();
    const reply = createComment({ parentId: head.id.value, replyToCommentId: head.id.value });

    // When
    head.addReplies(2, LATER);
    head.removeReply(LATER);
    head.removeReply(LATER);

    // Then
    expect(head.replyCount).toBe(0);
    expect(() => head.removeReply(LATER)).toThrow(
      expect.objectContaining({ errorCode: ErrorCode.SYS_0003 }),
    );
    expect(() => reply.addReplies(1, LATER)).toThrow(
      expect.objectContaining({ errorCode: ErrorCode.SYS_0003 }),
    );
  });

  it("좋아요 수를 늘리고 줄이며 0 아래로는 내리지 않는다", () => {
    // Given
    const comment = createComment();

    // When
    comment.addLike(LATER);
    comment.removeLike(LATER);

    // Then
    expect(comment.likeCount).toBe(0);
    expect(() => comment.removeLike(LATER)).toThrow(
      expect.objectContaining({ errorCode: ErrorCode.SYS_0003 }),
    );
  });

  it("저장된 빈 원문은 null로 읽지만 다시 저장할 때는 원래 값을 둔다", () => {
    // Given
    const comment = createComment({ content: "" });

    // When
    const primitives = comment.toPrimitives();

    // Then
    expect({ content: comment.content, stored: primitives.content }).toEqual({
      content: null,
      stored: "",
    });
  });
});
