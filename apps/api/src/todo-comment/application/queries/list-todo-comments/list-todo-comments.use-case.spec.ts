import { TODO_COMMENT_LIMITS, TODO_COMMENT_SORT } from "@aido/validators";
import { createTodoCommentCacheMock, createTodoCommentRepositoryMock } from "@test/mocks/ports";

import { ListTodoCommentsUseCase } from "./list-todo-comments.use-case";

describe("ListTodoCommentsUseCase", () => {
	it("조회 시작 시 받은 불투명 generation으로만 첫 페이지 캐시를 읽고 채운다", async () => {
		const repository = createTodoCommentRepositoryMock();
		const cache = createTodoCommentCacheMock();
		const page = {
			items: [],
			nextCursor: null,
			hasNext: false,
			size: TODO_COMMENT_LIMITS.DEFAULT_PAGE_SIZE,
		};
		jest.mocked(repository.canAccessTodo).mockResolvedValue(true);
		jest
			.mocked(cache.readTopLevelFirstPage)
			.mockResolvedValue({ generation: "generation-17", page: undefined });
		jest.mocked(repository.listComments).mockResolvedValue(page);
		jest.mocked(repository.findLikedCommentIds).mockResolvedValue(new Set());
		const useCase = new ListTodoCommentsUseCase(repository, cache);

		await useCase.execute({
			todoId: 42,
			viewerId: "cm1viewer0000000000000001",
			sort: TODO_COMMENT_SORT.LATEST,
			size: TODO_COMMENT_LIMITS.DEFAULT_PAGE_SIZE,
		});

		expect(cache.readTopLevelFirstPage).toHaveBeenCalledWith(42, TODO_COMMENT_SORT.LATEST);
		expect(cache.storeTopLevelFirstPageIfCurrent).toHaveBeenCalledWith(
			42,
			TODO_COMMENT_SORT.LATEST,
			"generation-17",
			page,
		);
	});
});
