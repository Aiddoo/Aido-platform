/**
 * GetTodosUseCase 단위 테스트
 *
 * - 날짜 범위 검증(startDate ≤ endDate) → 커서 정규화 → 저장소 조회 → 커서 응답 합성
 * - 정규화/응답 합성은 PaginationService가 소유하므로 여기서는 위임·파라미터 매핑만 검증한다
 */
import { ErrorCode } from "@aido/errors";
import type { Todo as TodoResponse } from "@aido/validators";
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { TodoBuilder } from "@test/builders";
import { createTodoReadRepositoryMock } from "@test/mocks/ports";

import { PaginationService } from "@/shared/application/pagination";

import { TodoMapper } from "../../../infrastructure/persistence/todo-response.mapper";
import {
	TODO_READ_REPOSITORY,
	type TodoReadRepositoryPort,
} from "../../ports/todo-read.repository.port";
import { GetTodosUseCase } from "./get-todos.use-case";

function buildResponse(id: number): TodoResponse {
	return TodoMapper.toResponse(TodoBuilder.create("user-123").withId(id).build());
}

describe("GetTodosUseCase — Todo 목록 커서 페이지네이션 조회", () => {
	let useCase: GetTodosUseCase;
	let todoReadRepository: Mocked<TodoReadRepositoryPort>;
	let paginationService: Mocked<PaginationService>;

	const baseInput = { userId: "user-123" };

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(GetTodosUseCase)
			.mock<TodoReadRepositoryPort>(TODO_READ_REPOSITORY)
			.impl(() => createTodoReadRepositoryMock())
			.compile();

		useCase = unit;
		todoReadRepository = unitRef.get<TodoReadRepositoryPort>(TODO_READ_REPOSITORY);
		paginationService = unitRef.get(PaginationService);

		// PaginationService는 auto-mock이므로 실제 규칙과 동일하게 스텁한다
		paginationService.normalizeCursorPagination.mockImplementation((params) => {
			const size = params.size ?? 20;
			return { cursor: params.cursor, size, take: size + 1 };
		});
		paginationService.createCursorPaginatedResponse.mockImplementation((params) => {
			const { items, size } = params;
			const hasNext = items.length > size;
			const actualItems = hasNext ? items.slice(0, size) : items;
			const lastItem = actualItems[actualItems.length - 1];
			return {
				items: actualItems,
				pagination: {
					nextCursor: hasNext && lastItem ? lastItem.id : null,
					hasNext,
					size,
				},
			};
		});
	});

	it("필터·커서·날짜 범위를 정규화된 size와 함께 저장소 파라미터로 매핑한다", async () => {
		// Given
		todoReadRepository.findManyByUserId.mockResolvedValue([buildResponse(1)]);
		const startDate = new Date("2026-07-01T00:00:00.000Z");
		const endDate = new Date("2026-07-31T00:00:00.000Z");

		// When
		await useCase.execute({
			...baseInput,
			cursor: 5,
			size: 10,
			completed: true,
			categoryId: 3,
			startDate,
			endDate,
		});

		// Then - 정규화된 cursor/size가 그대로 실린다
		expect(todoReadRepository.findManyByUserId).toHaveBeenCalledWith({
			userId: "user-123",
			cursor: 5,
			size: 10,
			completed: true,
			categoryId: 3,
			startDate,
			endDate,
		});
	});

	it("size 미지정 시 기본 size(20)로 정규화해 조회한다", async () => {
		// Given
		todoReadRepository.findManyByUserId.mockResolvedValue([]);

		// When
		await useCase.execute(baseInput);

		// Then
		expect(paginationService.normalizeCursorPagination).toHaveBeenCalledWith({
			cursor: undefined,
			size: undefined,
		});
		expect(todoReadRepository.findManyByUserId).toHaveBeenCalledWith(
			expect.objectContaining({ userId: "user-123", size: 20 }),
		);
	});

	it("size+1개가 조회되면 초과분을 잘라내고 nextCursor를 마지막 항목 id로 채운다", async () => {
		// Given - size=2 요청, 저장소는 다음 페이지 확인용으로 3개 반환
		const items = [buildResponse(10), buildResponse(9), buildResponse(8)];
		todoReadRepository.findManyByUserId.mockResolvedValue(items);

		// When
		const result = await useCase.execute({ ...baseInput, size: 2 });

		// Then - 2개만 노출, hasNext=true, nextCursor=마지막 노출 항목(9)
		expect(result.items).toHaveLength(2);
		expect(result.pagination).toEqual({
			nextCursor: 9,
			hasNext: true,
			size: 2,
		});
	});

	it("마지막 페이지는 hasNext=false, nextCursor=null이다", async () => {
		// Given - size=20, 1개만 반환 (초과분 없음)
		todoReadRepository.findManyByUserId.mockResolvedValue([buildResponse(1)]);

		// When
		const result = await useCase.execute(baseInput);

		// Then
		expect(result.items).toHaveLength(1);
		expect(result.pagination).toEqual({
			nextCursor: null,
			hasNext: false,
			size: 20,
		});
	});

	it("startDate > endDate이면 SYS_0002를 던지고 저장소를 조회하지 않는다", async () => {
		// When & Then
		await expect(
			useCase.execute({
				...baseInput,
				startDate: new Date("2026-07-31T00:00:00.000Z"),
				endDate: new Date("2026-07-01T00:00:00.000Z"),
			}),
		).rejects.toMatchObject({ errorCode: ErrorCode.SYS_0002 });
		expect(paginationService.normalizeCursorPagination).not.toHaveBeenCalled();
		expect(todoReadRepository.findManyByUserId).not.toHaveBeenCalled();
	});

	it("startDate == endDate는 유효 범위로 통과시킨다 (경계값)", async () => {
		// Given
		const sameDay = new Date("2026-07-15T00:00:00.000Z");
		todoReadRepository.findManyByUserId.mockResolvedValue([]);

		// When
		await useCase.execute({
			...baseInput,
			startDate: sameDay,
			endDate: sameDay,
		});

		// Then - 예외 없이 조회 진행
		expect(todoReadRepository.findManyByUserId).toHaveBeenCalledTimes(1);
	});

	it("startDate만 있고 endDate가 없으면 범위 검증을 건너뛴다", async () => {
		// Given
		todoReadRepository.findManyByUserId.mockResolvedValue([]);

		// When
		await useCase.execute({
			...baseInput,
			startDate: new Date("2026-07-31T00:00:00.000Z"),
		});

		// Then - endDate 부재 시 비교하지 않고 정상 조회
		expect(todoReadRepository.findManyByUserId).toHaveBeenCalledTimes(1);
	});
});
