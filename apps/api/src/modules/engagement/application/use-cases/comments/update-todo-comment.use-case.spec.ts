import { vi } from "vitest";

import {
  createMutationLockMock,
  createTodoCommentReaderMock,
  createTodoCommentRepositoryMock,
  createUnitOfWorkMock,
} from "#test/mocks/ports/index";

import { TodoComment } from "../../../domain/aggregates/comments/todo-comment.aggregate.js";
import type { TodoCommentRecord } from "../../models/comments/todo-comment.types.js";
import { UpdateTodoComment } from "./update-todo-comment.use-case.js";

const TODO_ID = 1;
const COMMENT_ID = "cm1todoacomment00000000001";
const AUTHOR_ID = "cm1author0000000000000001";

function createComment(): TodoComment {
  const createdAt = new Date("2026-08-16T00:00:00.000Z");
  return TodoComment.reconstitute({
    id: COMMENT_ID,
    todoId: TODO_ID,
    authorId: AUTHOR_ID,
    parentId: null,
    rootId: null,
    path: [],
    content: "수정 전",
    deletedAt: null,
    editedAt: null,
    createdAt,
    updatedAt: createdAt,
  });
}

function createRecord(): TodoCommentRecord {
  return {
    id: COMMENT_ID,
    todoId: TODO_ID,
    parentId: null,
    rootId: null,
    path: [],
    depth: 0,
    parentAuthorName: null,
    authorId: AUTHOR_ID,
    authorName: "작성자",
    authorProfileImage: null,
    todoOwnerId: AUTHOR_ID,
    content: "수정 후",
    likeCount: 0,
    replyCount: 0,
    deletedAt: null,
    editedAt: "2026-08-16T00:01:00.000Z",
    createdAt: "2026-08-16T00:00:00.000Z",
  };
}

describe("UpdateTodoComment", () => {
  it("댓글 잠금 안에서 수정하고 reader projection을 반환한다", async () => {
    const repository = createTodoCommentRepositoryMock();
    const reader = createTodoCommentReaderMock();
    const mutationLock = createMutationLockMock();
    vi.mocked(reader.canAccessTodo).mockResolvedValue(true);
    vi.mocked(repository.findComment).mockResolvedValue(createComment());
    vi.mocked(repository.updateComment).mockResolvedValue(true);
    vi.mocked(reader.findCommentRecord).mockResolvedValue(createRecord());
    vi.mocked(reader.findLikedCommentIds).mockResolvedValue(new Set());
    const useCase = new UpdateTodoComment({
      reader: reader,
      repository: repository,
      mutationLock: mutationLock,
      unitOfWork: createUnitOfWorkMock(),
    });

    await expect(
      useCase.execute({
        todoId: TODO_ID,
        commentId: COMMENT_ID,
        userId: AUTHOR_ID,
        content: "수정 후",
      }),
    ).resolves.toMatchObject({ comment: { id: COMMENT_ID, content: "수정 후" } });

    expect(mutationLock.acquire).toHaveBeenCalledWith([`mutation:v1:todo-comment:${COMMENT_ID}`]);
    expect(reader.findCommentRecord).toHaveBeenCalledWith(TODO_ID, COMMENT_ID);
  });
});
