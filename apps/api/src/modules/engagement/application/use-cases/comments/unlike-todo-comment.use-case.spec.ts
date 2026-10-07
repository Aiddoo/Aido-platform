import { vi } from "vitest";

import {
  createMutationLockMock,
  createTodoCommentReaderMock,
  createTodoCommentRepositoryMock,
  createUnitOfWorkMock,
} from "#test/mocks/ports/index";

import { TodoComment } from "../../../domain/aggregates/comments/todo-comment.aggregate.js";
import { UnlikeTodoComment } from "./unlike-todo-comment.use-case.js";

const TODO_ID = 1;
const COMMENT_ID = "cm1todoacomment00000000001";
const USER_ID = "cm1author0000000000000001";

describe("UnlikeTodoComment", () => {
  it("댓글 잠금 안에서 좋아요를 취소한다", async () => {
    const repository = createTodoCommentRepositoryMock();
    const reader = createTodoCommentReaderMock();
    const mutationLock = createMutationLockMock();
    const createdAt = new Date("2026-08-16T00:00:00.000Z");
    vi.mocked(reader.canAccessTodo).mockResolvedValue(true);
    vi.mocked(repository.findComment).mockResolvedValue(
      TodoComment.reconstitute({
        id: COMMENT_ID,
        todoId: TODO_ID,
        authorId: USER_ID,
        parentId: null,
        rootId: null,
        path: [],
        content: "댓글",
        deletedAt: null,
        editedAt: null,
        createdAt,
        updatedAt: createdAt,
      }),
    );
    vi.mocked(repository.removeLike).mockResolvedValue({
      commentId: COMMENT_ID,
      commentAuthorId: USER_ID,
      changed: true,
      isLiked: false,
      likeCount: 0,
      wasEverNotified: true,
    });
    const useCase = new UnlikeTodoComment({
      reader: reader,
      repository: repository,
      mutationLock: mutationLock,
      unitOfWork: createUnitOfWorkMock(),
    });

    await expect(
      useCase.execute({ todoId: TODO_ID, commentId: COMMENT_ID, userId: USER_ID }),
    ).resolves.toEqual({ commentId: COMMENT_ID, isLiked: false, likeCount: 0 });

    expect(mutationLock.acquire).toHaveBeenCalledWith([`mutation:v1:todo-comment:${COMMENT_ID}`]);
  });
});
