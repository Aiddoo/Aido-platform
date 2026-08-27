import {
	createMutationLockMock,
	createTodoCommentReaderMock,
	createTodoCommentRepositoryMock,
	createTodoViewCacheMock,
	createUnitOfWorkMock,
} from "@test/mocks/ports";

import { TodoComment } from "../../../domain/entities/todo-comment.aggregate";
import { DeleteTodoCommentUseCase } from "./delete-todo-comment.use-case";

const TODO_ID = 1;
const ROOT_ID = "cm1rootcomment000000000001";
const PARENT_ID = "cm1parentcomment0000000001";
const COMMENT_ID = "cm1childcomment00000000001";
const AUTHOR_ID = "cm1author0000000000000001";

function createComment(): TodoComment {
	const createdAt = new Date("2026-08-16T00:00:00.000Z");
	return TodoComment.reconstitute({
		id: COMMENT_ID,
		todoId: TODO_ID,
		authorId: AUTHOR_ID,
		parentId: PARENT_ID,
		rootId: ROOT_ID,
		path: [ROOT_ID, PARENT_ID],
		content: "삭제할 댓글",
		deletedAt: null,
		editedAt: null,
		createdAt,
		updatedAt: createdAt,
	});
}

describe("DeleteTodoCommentUseCase", () => {
	it("댓글과 정산 대상 조상을 함께 잠그고 조건부 삭제한다", async () => {
		const repository = createTodoCommentRepositoryMock();
		const reader = createTodoCommentReaderMock();
		const todoViewCache = createTodoViewCacheMock();
		const mutationLock = createMutationLockMock();
		jest.mocked(reader.canAccessTodo).mockResolvedValue(true);
		jest.mocked(repository.findComment).mockResolvedValue(createComment());
		jest.mocked(repository.decrementTodoCommentCount).mockResolvedValue(true);
		jest.mocked(repository.deleteComment).mockResolvedValue(true);
		const useCase = new DeleteTodoCommentUseCase(
			reader,
			repository,
			todoViewCache,
			mutationLock,
			createUnitOfWorkMock(),
		);

		await expect(
			useCase.execute({ todoId: TODO_ID, commentId: COMMENT_ID, userId: AUTHOR_ID }),
		).resolves.toEqual({ commentId: COMMENT_ID, isDeleted: true });

		expect(mutationLock.acquire).toHaveBeenCalledWith([
			`mutation:v1:todo-comment:${COMMENT_ID}`,
			`mutation:v1:todo-comment:${ROOT_ID}`,
			`mutation:v1:todo-comment:${PARENT_ID}`,
		]);
		expect(repository.findComment).toHaveBeenCalledTimes(2);
		expect(todoViewCache.invalidateForTodo).toHaveBeenCalledWith(TODO_ID);
	});
});
