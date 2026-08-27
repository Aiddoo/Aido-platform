import { ErrorCode } from "@aido/errors";
import {
	createMutationLockMock,
	createTodoCommentNotificationMock,
	createTodoCommentReaderMock,
	createTodoCommentRepositoryMock,
	createTodoViewCacheMock,
	createUnitOfWorkMock,
} from "@test/mocks/ports";

import {
	TodoCommentIdempotencyConflict,
	TodoCommentIdempotencyRace,
} from "../../ports/todo-comment.repository.port";
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
	};
}

function setup() {
	const reader = createTodoCommentReaderMock();
	const repository = createTodoCommentRepositoryMock();
	const notification = createTodoCommentNotificationMock();
	const todoViewCache = createTodoViewCacheMock();
	const mutationLock = createMutationLockMock();
	const unitOfWork = createUnitOfWorkMock();

	jest.mocked(reader.canAccessTodo).mockResolvedValue(true);
	jest.mocked(reader.findCommentRecords).mockResolvedValue([createRecord()]);
	jest.mocked(reader.findLikedCommentIds).mockResolvedValue(new Set());
	jest.mocked(repository.findCommentChainReplay).mockResolvedValue(null);
	jest.mocked(repository.createCommentChain).mockResolvedValue({
		commentIds: [COMMENT_ID],
		createdCount: 1,
	});
	jest.mocked(repository.increaseTodoCommentCount).mockResolvedValue(undefined);
	jest.mocked(repository.incrementReplyCount).mockResolvedValue(true);

	const useCase = new WriteTodoCommentChainUseCase(
		reader,
		repository,
		notification,
		todoViewCache,
		mutationLock,
		unitOfWork,
	);
	const execute = () =>
		useCase.execute({
			todoId: TODO_ID,
			authorId: AUTHOR_ID,
			parentId: null,
			items: [
				{
					clientRequestId: "b7b0f6d4-6f1e-4d6a-9e0a-2d6a1c1f3a11",
					content: "함께 해요",
				},
			],
		});

	return { execute, reader, repository, notification, todoViewCache, mutationLock, unitOfWork };
}

describe("WriteTodoCommentChainUseCase", () => {
	it("알림이 실패해도 커밋된 댓글을 성공으로 돌려준다", async () => {
		const { execute, notification } = setup();
		jest.mocked(notification.notifyCommentsWritten).mockRejectedValue(new Error("push down"));

		await expect(execute()).resolves.toMatchObject({ comments: [{ id: COMMENT_ID }] });
	});

	it("한 커밋 후 작업이 실패해도 나머지 작업은 실행한다", async () => {
		const { execute, notification, todoViewCache } = setup();
		jest.mocked(todoViewCache.invalidateForTodo).mockRejectedValue(new Error("cache down"));

		await execute();

		expect(notification.notifyCommentsWritten).toHaveBeenCalledTimes(1);
	});

	it("작성 멱등 키 잠금을 업무 트랜잭션 안에서 획득한다", async () => {
		const { execute, mutationLock } = setup();

		await execute();

		expect(mutationLock.acquire).toHaveBeenCalledWith([
			"mutation:v1:todo-comment-request:cm1author0000000000000001:b7b0f6d4-6f1e-4d6a-9e0a-2d6a1c1f3a11",
		]);
	});

	it("정확한 replay는 생성과 counter 변경을 건너뛰고 viewer 좋아요를 보존한다", async () => {
		const { execute, reader, repository } = setup();
		jest.mocked(repository.findCommentChainReplay).mockResolvedValue([COMMENT_ID]);
		jest.mocked(reader.findLikedCommentIds).mockResolvedValue(new Set([COMMENT_ID]));

		await expect(execute()).resolves.toMatchObject({
			comments: [{ id: COMMENT_ID, viewer: { isLiked: true } }],
		});

		expect(repository.createCommentChain).not.toHaveBeenCalled();
		expect(repository.increaseTodoCommentCount).not.toHaveBeenCalled();
	});

	it("같은 멱등 키의 다른 명령을 잘못된 파라미터 오류로 변환한다", async () => {
		const { execute, repository } = setup();
		jest
			.mocked(repository.findCommentChainReplay)
			.mockRejectedValue(new TodoCommentIdempotencyConflict());

		await expect(execute()).rejects.toMatchObject({ errorCode: ErrorCode.SYS_0002 });
	});

	it("P2002 경합은 실패한 UoW 밖에서 승자 행을 replay한다", async () => {
		const { execute, repository, unitOfWork } = setup();
		jest
			.mocked(repository.findCommentChainReplay)
			.mockResolvedValueOnce(null)
			.mockResolvedValueOnce([COMMENT_ID]);
		jest.mocked(repository.createCommentChain).mockRejectedValue(new TodoCommentIdempotencyRace());

		await expect(execute()).resolves.toMatchObject({ comments: [{ id: COMMENT_ID }] });

		expect(unitOfWork.run).toHaveBeenCalledTimes(2);
		expect(repository.increaseTodoCommentCount).not.toHaveBeenCalled();
	});

	it("P2002 뒤 승자 명령이 다르면 잘못된 파라미터 오류로 변환한다", async () => {
		const { execute, repository } = setup();
		jest
			.mocked(repository.findCommentChainReplay)
			.mockResolvedValueOnce(null)
			.mockRejectedValueOnce(new TodoCommentIdempotencyConflict());
		jest.mocked(repository.createCommentChain).mockRejectedValue(new TodoCommentIdempotencyRace());

		await expect(execute()).rejects.toMatchObject({ errorCode: ErrorCode.SYS_0002 });
	});
});
