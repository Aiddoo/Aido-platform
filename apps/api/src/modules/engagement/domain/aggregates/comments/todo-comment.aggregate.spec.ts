import { ErrorCode } from "@aido/api/errors";

import { DomainException } from "#api/shared/domain/index";

import { TodoComment } from "./todo-comment.aggregate.js";

const AUTHOR_ID = "cm1author0000000000000001";
const OWNER_ID = "cm1owner00000000000000001";

function createComment(overrides: Partial<Parameters<typeof TodoComment.reconstitute>[0]> = {}) {
  const createdAt = new Date("2026-08-14T00:00:00.000Z");
  return TodoComment.reconstitute({
    id: "cm1todoacomment00000000001",
    todoId: 1,
    authorId: AUTHOR_ID,
    parentId: null,
    replyToCommentId: null,
    content: "함께 해요",
    replyCount: 0,
    deletedAt: null,
    editedAt: null,
    createdAt,
    updatedAt: createdAt,
    ...overrides,
  });
}

describe("TodoComment — 댓글 Aggregate", () => {
  it("작성자가 댓글을 수정한다", () => {
    // Given
    const comment = createComment();
    const editedAt = new Date("2026-08-14T01:00:00.000Z");

    // When
    comment.edit("cm1author0000000000000001", "  수정된 댓글  ", editedAt);

    // Then
    expect(comment.content).toBe("수정된 댓글");
    expect(comment.editedAt).toEqual(editedAt);
  });

  it("다른 사용자의 수정을 거부한다", () => {
    // Given
    const comment = createComment();

    try {
      comment.edit("cm1another000000000000001", "수정", new Date("2026-08-14T01:00:00.000Z"));
      throw new Error("예외가 발생해야 합니다.");
    } catch (error) {
      expect(error).toBeInstanceOf(DomainException);
      expect(error).toMatchObject({ errorCode: ErrorCode.TODO_0832 });
    }
  });

  it("삭제 시 원문을 제거하고 같은 요청을 멱등 처리한다", () => {
    // Given
    const comment = createComment();
    const deletedAt = new Date("2026-08-14T02:00:00.000Z");

    const first = comment.markDeleted({ actorId: AUTHOR_ID, todoOwnerId: OWNER_ID, deletedAt });
    const second = comment.markDeleted({
      actorId: AUTHOR_ID,
      todoOwnerId: OWNER_ID,
      deletedAt: new Date("2026-08-14T03:00:00.000Z"),
    });

    expect([first, second]).toEqual([true, false]);
    expect(comment.content).toBeNull();
    expect(comment.deletedAt).toEqual(deletedAt);
  });

  it("할 일 주인은 자기 할 일에 달린 남의 댓글을 지울 수 있다", () => {
    // Given
    const comment = createComment();
    const deletedAt = new Date("2026-08-14T02:00:00.000Z");

    // When
    comment.markDeleted({ actorId: OWNER_ID, todoOwnerId: OWNER_ID, deletedAt });

    // Then
    expect(comment.content).toBeNull();
    expect(comment.deletedAt).toEqual(deletedAt);
  });

  it("작성자도 할 일 주인도 아니면 지울 수 없다", () => {
    // Given
    const comment = createComment();

    // When / Then
    expect(() =>
      comment.markDeleted({
        actorId: "cm1stranger00000000000001",
        todoOwnerId: OWNER_ID,
        deletedAt: new Date("2026-08-14T02:00:00.000Z"),
      }),
    ).toThrow(expect.objectContaining({ errorCode: ErrorCode.TODO_0832 }));
  });

  it("삭제된 댓글의 상호작용을 거부한다", () => {
    // Given
    const comment = createComment({
      content: null,
      deletedAt: new Date("2026-08-14T02:00:00.000Z"),
    });

    // When / Then
    expect(() => comment.assertActive()).toThrow(DomainException);
  });

  it("댓글은 자기 자신이 묶음 머리다", () => {
    // Given
    const comment = createComment();

    // When / Then
    expect(comment.threadCommentId).toBe("cm1todoacomment00000000001");
    expect(comment.isReply).toBe(false);
  });

  it("답글에 답한 자리는 같은 묶음에 붙고 답글 대상만 바뀐다", () => {
    // Given
    const reply = createComment({
      id: "cm1todoacomment00000000002",
      parentId: "cm1todoacomment00000000001",
      replyToCommentId: "cm1todoacomment00000000001",
    });

    // When
    const placement = reply.placeReply();

    // Then
    expect(placement).toEqual({
      kind: "REPLY",
      threadCommentId: "cm1todoacomment00000000001",
      replyToCommentId: "cm1todoacomment00000000002",
    });
  });

  it("댓글은 답글 수를 늘리고 줄인다", () => {
    // Given
    const comment = createComment({ replyCount: 1 });

    // When
    comment.applyReplyAdded(2);
    comment.applyReplyRemoved();

    // Then
    expect(comment.replyCount).toBe(2);
  });

  it("답글은 답글 수를 갖지 않는다", () => {
    // Given
    const reply = createComment({
      parentId: "cm1todoacomment00000000009",
      replyToCommentId: "cm1todoacomment00000000009",
    });

    // When / Then
    expect(() => reply.applyReplyAdded(1)).toThrow(DomainException);
    expect(() => reply.applyReplyRemoved()).toThrow(DomainException);
  });

  it("답글 수는 0 아래로 내려가지 않는다", () => {
    // Given
    const comment = createComment();

    // When / Then
    expect(() => comment.applyReplyRemoved()).toThrow(
      expect.objectContaining({ errorCode: ErrorCode.SYS_0003 }),
    );
  });

  it("삭제된 댓글은 답글을 받지 못한다", () => {
    const comment = createComment({
      content: null,
      deletedAt: new Date("2026-08-14T02:00:00.000Z"),
    });

    expect(() => comment.placeReply()).toThrow(DomainException);
  });

  it("잘못된 수정은 원문과 수정 시각을 부분적으로 바꾸지 않는다", () => {
    // Given
    const comment = createComment();
    const before = comment.snapshot;

    // When / Then
    expect(() =>
      comment.edit(comment.authorId, "   ", new Date("2026-08-14T01:00:00.000Z")),
    ).toThrow(expect.objectContaining({ errorCode: ErrorCode.SYS_0002 }));
    expect(comment.snapshot).toEqual(before);
  });

  it("복원 날짜의 외부 변경은 댓글의 저장 상태를 바꾸지 않는다", () => {
    // Given
    const date = new Date("2026-08-14T01:00:00.000Z");
    const commentId = "cm1todoacomment00000000001";
    const comment = createComment({
      parentId: commentId,
      replyToCommentId: commentId,
      createdAt: date,
      updatedAt: date,
      editedAt: date,
    });

    // When
    date.setUTCFullYear(2030);

    // Then
    expect(comment.snapshot).toMatchObject({
      parentId: commentId,
      createdAt: new Date("2026-08-14T01:00:00.000Z"),
      updatedAt: new Date("2026-08-14T01:00:00.000Z"),
      editedAt: new Date("2026-08-14T01:00:00.000Z"),
    });
  });

  it("snapshot 날짜 변경은 삭제된 댓글의 삭제·수정·저장 시각에 영향을 주지 않는다", () => {
    // Given
    const at = new Date("2026-08-14T01:00:00.000Z");
    const comment = createComment({ content: null, deletedAt: at, editedAt: at });
    const before = comment.snapshot;
    const snapshot = comment.snapshot;

    // When
    if (snapshot.deletedAt != null) {
      snapshot.deletedAt.setUTCFullYear(2030);
    }
    if (snapshot.editedAt != null) {
      snapshot.editedAt.setUTCFullYear(2030);
    }
    snapshot.createdAt.setUTCFullYear(2030);
    snapshot.updatedAt.setUTCFullYear(2030);

    // Then
    expect(comment.snapshot).toEqual(before);
    expect(comment.isDeleted).toBe(true);
  });

  it("저장된 빈 원문은 이전 복원 계약대로 null로 읽는다", () => {
    // Given / When
    const comment = createComment({ content: "" });

    // Then
    expect(comment.content).toBeNull();
    expect(comment.editedAt).toBeNull();
    expect(comment.isDeleted).toBe(false);
  });
});
