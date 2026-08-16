import {
	createTodoCommentCacheMock,
	createTodoCommentNotificationMock,
	createTodoCommentRepositoryMock,
	createTodoViewCacheMock,
	createUnitOfWorkMock,
} from "@test/mocks/ports";

import type { TodoCommentRecord } from "../../types";
import { WriteTodoCommentChainUseCase } from "./write-todo-comment-chain.use-case";

const TODO_ID = 1;
const AUTHOR_ID = "cm1author0000000000000001";
const OWNER_ID = "cm1owner00000000000000001";
const COMMENT_ID = "cm1todoacomment00000000001";

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
		authorName: "쓴 사람",
		authorProfileImage: null,
		todoOwnerId: OWNER_ID,
		content: "함께 해요",
		likeCount: 0,
		replyCount: 0,
		deletedAt: null,
		editedAt: null,
		createdAt: "2026-08-16T00:00:00.000Z",
		children: [],
	};
}

function setup() {
	const repository = createTodoCommentRepositoryMock();
	const cache = createTodoCommentCacheMock();
	const notification = createTodoCommentNotificationMock();
	const todoViewCache = createTodoViewCacheMock();

	jest.mocked(repository.canAccessTodo).mockResolvedValue(true);
	jest
		.mocked(repository.createCommentChain)
		.mockResolvedValue({ comments: [createRecord()], createdCount: 1 });

	const useCase = new WriteTodoCommentChainUseCase(
		repository,
		cache,
		notification,
		todoViewCache,
		createUnitOfWorkMock(),
	);

	const execute = () =>
		useCase.execute({
			todoId: TODO_ID,
			authorId: AUTHOR_ID,
			parentId: null,
			items: [{ clientRequestId: "b7b0f6d4-6f1e-4d6a-9e0a-2d6a1c1f3a11", content: "함께 해요" }],
		});

	return { execute, cache, notification, todoViewCache };
}

/**
 * 트랜잭션은 이미 커밋된 뒤다. 여기서 던지면 글은 남았는데 500이 나가고,
 * 같은 clientRequestId로 재시도하면 멱등 경로가 이 블록을 통째로 건너뛴다.
 */
describe("WriteTodoCommentChainUseCase 커밋 후 부수 작업", () => {
	it("알림이 실패해도 쓴 글을 성공으로 돌려준다", async () => {
		const { execute, notification } = setup();
		jest.mocked(notification.notifyCommentsWritten).mockRejectedValue(new Error("push down"));

		await expect(execute()).resolves.toMatchObject({ comments: [{ id: COMMENT_ID }] });
	});

	it("한 다리가 실패해도 나머지 다리는 그대로 실행한다", async () => {
		const { execute, cache, notification, todoViewCache } = setup();
		jest
			.mocked(todoViewCache.invalidateForTodo)
			.mockRejectedValue(new Error("owner lookup failed"));

		await execute();

		expect(cache.invalidateTopLevelFirstPages).toHaveBeenCalledWith(TODO_ID);
		expect(notification.notifyCommentsWritten).toHaveBeenCalledTimes(1);
	});
});
