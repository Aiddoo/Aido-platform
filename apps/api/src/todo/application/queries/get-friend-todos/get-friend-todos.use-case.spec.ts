/**
 * GetFriendTodosUseCase 단위 테스트
 *
 * - 날짜 검증 → 맞팔 권한 확인 → 첫 페이지 캐시 조회 → 미스 시 조회·캐싱
 * - 캐시는 첫 페이지(cursor 미지정)만, 권한 확인은 캐시 히트와 무관하게 매 요청 수행
 */
import { ErrorCode } from "@aido/errors";
import type { Todo as TodoResponse } from "@aido/validators";
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { TodoBuilder } from "@test/builders";
import {
	createFriendMock,
	createTodoCacheMock,
	createTodoReadRepositoryMock,
} from "@test/mocks/ports";
import type { CursorPaginatedResponse } from "@/shared/application/pagination";
import { PaginationService } from "@/shared/application/pagination";
import { TodoMapper } from "../../../infrastructure/persistence/todo-response.mapper";
import { FRIEND_PORT, type FriendPort } from "../../ports/friend.port";
import { TODO_CACHE, type TodoCachePort } from "../../ports/todo-cache.port";
import {
	TODO_READ_REPOSITORY,
	type TodoReadRepositoryPort,
} from "../../ports/todo-read.repository.port";
import { GetFriendTodosUseCase } from "./get-friend-todos.use-case";

function buildResponse(id: number): TodoResponse {
	return TodoMapper.toResponse(
		TodoBuilder.create("friend-1").withId(id).build(),
	);
}

function buildPage(
	items: TodoResponse[],
): CursorPaginatedResponse<TodoResponse, number> {
	return {
		items,
		pagination: { nextCursor: null, hasNext: false, size: 20 },
	};
}

describe("GetFriendTodosUseCase — 친구 PUBLIC Todo 조회 핸들러", () => {
	let useCase: GetFriendTodosUseCase;
	let todoReadRepository: Mocked<TodoReadRepositoryPort>;
	let friendPort: Mocked<FriendPort>;
	let todoCache: Mocked<TodoCachePort>;
	let paginationService: Mocked<PaginationService>;

	const baseInput = {
		userId: "user-123",
		friendUserId: "friend-1",
	};

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(GetFriendTodosUseCase)
			.mock<TodoReadRepositoryPort>(TODO_READ_REPOSITORY)
			.impl(() => createTodoReadRepositoryMock())
			.mock<FriendPort>(FRIEND_PORT)
			.impl(() => createFriendMock())
			.mock<TodoCachePort>(TODO_CACHE)
			.impl(() => createTodoCacheMock())
			.compile();

		useCase = unit;
		todoReadRepository =
			unitRef.get<TodoReadRepositoryPort>(TODO_READ_REPOSITORY);
		friendPort = unitRef.get<FriendPort>(FRIEND_PORT);
		todoCache = unitRef.get<TodoCachePort>(TODO_CACHE);
		paginationService = unitRef.get(PaginationService);

		friendPort.isMutualFriend.mockResolvedValue(true);
		paginationService.normalizeCursorPagination.mockImplementation((params) => {
			const size = params.size ?? 20;
			return { cursor: params.cursor, size, take: size + 1 };
		});
		paginationService.createCursorPaginatedResponse.mockImplementation(
			(params) => {
				const { items, size } = params;
				const hasNext = items.length > size;
				const actualItems = hasNext ? items.slice(0, size) : items;
				return {
					items: actualItems,
					pagination: { nextCursor: null, hasNext, size },
				};
			},
		);
	});

	it("첫 페이지 캐시 히트 시 저장소를 거치지 않고 캐시 값을 반환한다 (권한 확인은 수행)", async () => {
		// Given - 캐시에 첫 페이지 존재
		const cachedPage = buildPage([buildResponse(1)]);
		todoCache.getFriendTodosFirstPage.mockResolvedValue(cachedPage);

		// When
		const result = await useCase.execute({
			...baseInput,
			startDate: new Date("2026-07-01"),
			endDate: new Date("2026-07-31"),
		});

		// Then - 맞팔 확인은 매 요청 수행, 저장소·set은 미호출
		expect(friendPort.isMutualFriend).toHaveBeenCalledWith(
			"user-123",
			"friend-1",
		);
		expect(todoCache.getFriendTodosFirstPage).toHaveBeenCalledWith(
			"friend-1",
			"2026-07-01",
			"2026-07-31",
			20,
		);
		expect(todoReadRepository.findPublicTodosByUserId).not.toHaveBeenCalled();
		expect(todoCache.setFriendTodosFirstPage).not.toHaveBeenCalled();
		expect(result).toBe(cachedPage);
	});

	it("첫 페이지 캐시 미스 시 저장소를 조회하고 정규화된 키로 캐싱한다", async () => {
		// Given - 캐시 미스
		todoCache.getFriendTodosFirstPage.mockResolvedValue(undefined);
		const items = [buildResponse(1), buildResponse(2)];
		todoReadRepository.findPublicTodosByUserId.mockResolvedValue(items);

		// When
		const result = await useCase.execute({
			...baseInput,
			startDate: new Date("2026-07-01"),
			endDate: new Date("2026-07-31"),
		});

		// Then - 조회 후 YYYY-MM-DD 정규화 키로 set
		expect(todoReadRepository.findPublicTodosByUserId).toHaveBeenCalledWith({
			friendUserId: "friend-1",
			cursor: undefined,
			size: 20,
			startDate: new Date("2026-07-01"),
			endDate: new Date("2026-07-31"),
		});
		expect(todoCache.setFriendTodosFirstPage).toHaveBeenCalledWith(
			"friend-1",
			"2026-07-01",
			"2026-07-31",
			20,
			result,
		);
		expect(result.items).toHaveLength(2);
	});

	it("날짜 미지정 시 키 날짜 세그먼트는 '-'로 정규화된다", async () => {
		// Given
		todoCache.getFriendTodosFirstPage.mockResolvedValue(undefined);
		todoReadRepository.findPublicTodosByUserId.mockResolvedValue([]);

		// When
		await useCase.execute(baseInput);

		// Then
		expect(todoCache.getFriendTodosFirstPage).toHaveBeenCalledWith(
			"friend-1",
			"-",
			"-",
			20,
		);
		expect(todoCache.setFriendTodosFirstPage).toHaveBeenCalledWith(
			"friend-1",
			"-",
			"-",
			20,
			expect.objectContaining({ items: [] }),
		);
	});

	it("커서 페이지는 캐시를 조회하지도 저장하지도 않는다", async () => {
		// Given - cursor 지정 (2페이지 이후)
		todoReadRepository.findPublicTodosByUserId.mockResolvedValue([
			buildResponse(6),
		]);

		// When
		await useCase.execute({ ...baseInput, cursor: 5 });

		// Then
		expect(todoCache.getFriendTodosFirstPage).not.toHaveBeenCalled();
		expect(todoCache.setFriendTodosFirstPage).not.toHaveBeenCalled();
		expect(todoReadRepository.findPublicTodosByUserId).toHaveBeenCalledWith(
			expect.objectContaining({ cursor: 5 }),
		);
	});

	it("startDate > endDate이면 SYS_0002를 던지고 캐시·저장소에 접근하지 않는다", async () => {
		// When & Then
		await expect(
			useCase.execute({
				...baseInput,
				startDate: new Date("2026-07-31"),
				endDate: new Date("2026-07-01"),
			}),
		).rejects.toMatchObject({ errorCode: ErrorCode.SYS_0002 });
		expect(friendPort.isMutualFriend).not.toHaveBeenCalled();
		expect(todoCache.getFriendTodosFirstPage).not.toHaveBeenCalled();
		expect(todoCache.setFriendTodosFirstPage).not.toHaveBeenCalled();
		expect(todoReadRepository.findPublicTodosByUserId).not.toHaveBeenCalled();
	});

	it("맞팔이 아니면 FOLLOW_0906을 던지고 캐시·저장소에 접근하지 않는다", async () => {
		// Given
		friendPort.isMutualFriend.mockResolvedValue(false);

		// When & Then
		await expect(useCase.execute(baseInput)).rejects.toMatchObject({
			errorCode: ErrorCode.FOLLOW_0906,
		});
		expect(todoCache.getFriendTodosFirstPage).not.toHaveBeenCalled();
		expect(todoCache.setFriendTodosFirstPage).not.toHaveBeenCalled();
		expect(todoReadRepository.findPublicTodosByUserId).not.toHaveBeenCalled();
	});
});
