import { ErrorCode } from "@aido/errors";
import { TodoBuilder } from "@test/builders";
import {
	createTodoCommentReaderMock,
	createTodoCommentRepositoryMock,
	createUnitOfWorkMock,
} from "@test/mocks/ports";

import { TodoMapper } from "@/todo/infrastructure/persistence/todo-response.mapper";

import type { TodoDetailsRecord } from "../../types";
import { GetTodoDetailsUseCase } from "./get-todo-details.use-case";

const TODO_ID = 42;
const OWNER_ID = "cmowner000000000000000001";
const VIEWER_ID = "cmviewer00000000000000001";

function createTodoDetails(isOwner: boolean): TodoDetailsRecord {
	return {
		todo: TodoMapper.toResponse(TodoBuilder.create(OWNER_ID).withId(TODO_ID).build()),
		owner: { id: OWNER_ID, name: "할 일 주인", profileImage: null },
		viewCount: 7,
		commentCount: 3,
		isOwner,
	};
}

describe("GetTodoDetailsUseCase", () => {
	it("소유자는 조회수를 추가하지 않고 편집 권한을 받는다", async () => {
		// Given
		const reader = createTodoCommentReaderMock();
		const repository = createTodoCommentRepositoryMock();
		jest.mocked(reader.findAccessibleTodoDetails).mockResolvedValue(createTodoDetails(true));
		const useCase = new GetTodoDetailsUseCase(reader, repository, createUnitOfWorkMock());

		// When
		const result = await useCase.execute({ todoId: TODO_ID, viewerId: OWNER_ID });

		// Then
		expect(result.permissions).toEqual({ canEdit: true, canComment: true, canNudge: false });
		expect(result.metrics).toEqual({ viewCount: 7, commentCount: 3 });
		expect(repository.recordView).not.toHaveBeenCalled();
	});

	it("방문자는 중복 제거된 조회수와 방문자 권한을 받는다", async () => {
		// Given
		const reader = createTodoCommentReaderMock();
		const repository = createTodoCommentRepositoryMock();
		jest.mocked(reader.findAccessibleTodoDetails).mockResolvedValue(createTodoDetails(false));
		jest.mocked(repository.recordView).mockResolvedValue({ recorded: true, viewCount: 8 });
		const useCase = new GetTodoDetailsUseCase(reader, repository, createUnitOfWorkMock());

		// When
		const result = await useCase.execute({ todoId: TODO_ID, viewerId: VIEWER_ID });

		// Then
		expect(repository.recordView).toHaveBeenCalledWith(TODO_ID, VIEWER_ID);
		expect(result.permissions).toEqual({ canEdit: false, canComment: true, canNudge: true });
		expect(result.metrics.viewCount).toBe(8);
	});

	it("접근할 수 없는 할 일은 조회수를 기록하지 않는다", async () => {
		// Given
		const reader = createTodoCommentReaderMock();
		const repository = createTodoCommentRepositoryMock();
		jest.mocked(reader.findAccessibleTodoDetails).mockResolvedValue(null);
		const useCase = new GetTodoDetailsUseCase(reader, repository, createUnitOfWorkMock());

		// When
		const result = useCase.execute({ todoId: TODO_ID, viewerId: VIEWER_ID });

		// Then
		await expect(result).rejects.toMatchObject({ errorCode: ErrorCode.TODO_0801 });
		expect(repository.recordView).not.toHaveBeenCalled();
	});
});
