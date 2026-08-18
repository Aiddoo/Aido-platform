import {
	createMutationLockMock,
	createTodoCommentCacheMock,
	createTodoCommentRepositoryMock,
	createUnitOfWorkMock,
} from "@test/mocks/ports";

import { TodoComment } from "../../../domain/entities/todo-comment.aggregate";
import { UnlikeTodoCommentUseCase } from "./unlike-todo-comment.use-case";

const TODO_ID = 1;
const COMMENT_ID = "cm1todoacomment00000000001";
const USER_ID = "cm1author0000000000000001";

describe("UnlikeTodoCommentUseCase", () => {
	it("댓글 잠금 안에서 취소하고 캐시 정리는 커밋 후 settle한다", async () => {
		const repository = createTodoCommentRepositoryMock();
		const cache = createTodoCommentCacheMock();
		const mutationLock = createMutationLockMock();
		const createdAt = new Date("2026-08-16T00:00:00.000Z");
		jest.mocked(repository.canAccessTodo).mockResolvedValue(true);
		jest.mocked(repository.findComment).mockResolvedValue(
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
		jest.mocked(repository.removeLike).mockResolvedValue({
			commentId: COMMENT_ID,
			commentAuthorId: USER_ID,
			changed: true,
			isLiked: false,
			likeCount: 0,
			wasEverNotified: true,
		});
		jest.mocked(cache.invalidateTopLevelFirstPages).mockRejectedValue(new Error("cache down"));
		const useCase = new UnlikeTodoCommentUseCase(
			repository,
			cache,
			mutationLock,
			createUnitOfWorkMock(),
		);

		await expect(
			useCase.execute({ todoId: TODO_ID, commentId: COMMENT_ID, userId: USER_ID }),
		).resolves.toEqual({ commentId: COMMENT_ID, isLiked: false, likeCount: 0 });

		expect(mutationLock.acquire).toHaveBeenCalledWith([`mutation:v1:todo-comment:${COMMENT_ID}`]);
		expect(cache.invalidateTopLevelFirstPages).toHaveBeenCalledWith(TODO_ID);
	});
});
