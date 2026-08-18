import {
	createMutationLockMock,
	createTodoCommentCacheMock,
	createTodoCommentNotificationMock,
	createTodoCommentRepositoryMock,
	createUnitOfWorkMock,
} from "@test/mocks/ports";

import { TodoComment } from "../../../domain/entities/todo-comment.aggregate";
import type { TodoCommentLikeTransition } from "../../types";
import { LikeTodoCommentUseCase } from "./like-todo-comment.use-case";

const TODO_ID = 1;
const COMMENT_ID = "cm1todoacomment00000000001";
const LIKER_ID = "cm1liker00000000000000001";
const AUTHOR_ID = "cm1author0000000000000001";

function createTransition(
	overrides: Partial<TodoCommentLikeTransition> = {},
): TodoCommentLikeTransition {
	return {
		commentId: COMMENT_ID,
		commentAuthorId: AUTHOR_ID,
		changed: true,
		isLiked: true,
		likeCount: 1,
		wasEverNotified: false,
		...overrides,
	};
}

function setup(transition = createTransition()) {
	const repository = createTodoCommentRepositoryMock();
	const cache = createTodoCommentCacheMock();
	const notification = createTodoCommentNotificationMock();
	const mutationLock = createMutationLockMock();

	const createdAt = new Date("2026-08-16T00:00:00.000Z");
	jest.mocked(repository.canAccessTodo).mockResolvedValue(true);
	jest.mocked(repository.findComment).mockResolvedValue(
		TodoComment.reconstitute({
			id: COMMENT_ID,
			todoId: TODO_ID,
			authorId: AUTHOR_ID,
			parentId: null,
			rootId: null,
			path: [],
			content: "함께 해요",
			deletedAt: null,
			editedAt: null,
			createdAt,
			updatedAt: createdAt,
		}),
	);
	jest.mocked(repository.findUserDisplayName).mockResolvedValue("좋아요 누른 사람");
	jest.mocked(repository.setLike).mockResolvedValue(transition);

	const useCase = new LikeTodoCommentUseCase(
		repository,
		cache,
		notification,
		mutationLock,
		createUnitOfWorkMock(),
	);

	return { useCase, repository, cache, notification };
}

describe("LikeTodoCommentUseCase", () => {
	it("알림을 보낸 뒤에 보냈다고 표시한다", async () => {
		const { useCase, repository, notification } = setup();

		await useCase.execute({ todoId: TODO_ID, commentId: COMMENT_ID, userId: LIKER_ID });

		expect(notification.notifyCommentLiked).toHaveBeenCalledTimes(1);
		expect(repository.markLikeNotified).toHaveBeenCalledWith(COMMENT_ID, LIKER_ID);
		expect(jest.mocked(notification.notifyCommentLiked).mock.invocationCallOrder[0]).toBeLessThan(
			jest.mocked(repository.markLikeNotified).mock.invocationCallOrder[0] ?? 0,
		);
	});

	/**
	 * 표시가 남으면 껐다 켜도 다시 시도되지 않아 그 좋아요는 영영 알려지지 않는다.
	 * 이 use-case가 지켜야 할 가장 중요한 불변식이다.
	 */
	it("알림 발송이 실패하면 보냈다고 표시하지 않는다", async () => {
		const { useCase, repository, notification } = setup();
		jest.mocked(notification.notifyCommentLiked).mockRejectedValue(new Error("push down"));

		const result = await useCase.execute({
			todoId: TODO_ID,
			commentId: COMMENT_ID,
			userId: LIKER_ID,
		});

		expect(repository.markLikeNotified).not.toHaveBeenCalled();
		expect(result.isLiked).toBe(true);
	});

	it("알림이 실패해도 좋아요 자체는 성공으로 돌려준다", async () => {
		const { useCase, cache, notification } = setup();
		jest.mocked(notification.notifyCommentLiked).mockRejectedValue(new Error("push down"));

		await expect(
			useCase.execute({ todoId: TODO_ID, commentId: COMMENT_ID, userId: LIKER_ID }),
		).resolves.toMatchObject({ commentId: COMMENT_ID, likeCount: 1 });

		expect(cache.invalidateTopLevelFirstPages).toHaveBeenCalledWith(TODO_ID);
	});

	it("이미 알린 좋아요는 껐다 켜도 다시 알리지 않는다", async () => {
		const { useCase, repository, notification, cache } = setup(
			createTransition({ wasEverNotified: true }),
		);

		await useCase.execute({ todoId: TODO_ID, commentId: COMMENT_ID, userId: LIKER_ID });

		expect(notification.notifyCommentLiked).not.toHaveBeenCalled();
		expect(repository.markLikeNotified).not.toHaveBeenCalled();
		expect(cache.invalidateTopLevelFirstPages).toHaveBeenCalledWith(TODO_ID);
	});
});
