/**
 * GetMemosUseCase 단위 테스트
 *
 * 커서 기반 페이지네이션(정규화 → 저장소 조회 → 응답 합성)과
 * 저장소가 내려준 고정 우선 정렬 순서 보존을 검증한다.
 */

import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { createMemoRepositoryMock } from "@test/mocks/ports/memo.mock";
import { PaginationService } from "@/shared/application/pagination";
import { Memo } from "../../../domain/entities/memo.aggregate";
import {
	MEMO_REPOSITORY,
	type MemoRepositoryPort,
} from "../../ports/memo.repository.port";
import { GetMemosUseCase } from "./get-memos.use-case";

const memoEntity = (id: number, isPinned = false): Memo =>
	Memo.reconstitute({
		id,
		userId: "user-1",
		content: `내용 ${id}`,
		isPinned,
		sortOrder: id,
		createdAt: new Date("2026-04-06T00:00:00.000Z"),
		updatedAt: new Date("2026-04-06T00:00:00.000Z"),
	});

describe("GetMemosUseCase — 메모 목록 조회 (커서 페이지네이션)", () => {
	let useCase: GetMemosUseCase;
	let repository: Mocked<MemoRepositoryPort>;
	let paginationService: Mocked<PaginationService>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(GetMemosUseCase)
			.mock<MemoRepositoryPort>(MEMO_REPOSITORY)
			.impl(() => createMemoRepositoryMock())
			.compile();

		useCase = unit;
		repository = unitRef.get<MemoRepositoryPort>(MEMO_REPOSITORY);
		paginationService = unitRef.get(PaginationService);

		// 실제 페이지네이션 규칙을 충실히 재현 (take = size + 1, 초과분 트리밍)
		paginationService.normalizeCursorPagination.mockImplementation((params) => {
			const size = params.size ?? 20;
			return { cursor: params.cursor, size, take: size + 1 };
		});
		paginationService.createCursorPaginatedResponse.mockImplementation(
			(params) => {
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
			},
		);
	});

	it("정규화된 커서·사이즈로 저장소를 조회한다", async () => {
		// Given
		repository.findManyByUserId.mockResolvedValue([memoEntity(3)]);

		// When
		await useCase.execute({ userId: "user-1", cursor: 10, size: 5 });

		// Then
		expect(paginationService.normalizeCursorPagination).toHaveBeenCalledWith({
			cursor: 10,
			size: 5,
		});
		expect(repository.findManyByUserId).toHaveBeenCalledWith({
			userId: "user-1",
			cursor: 10,
			size: 5,
		});
	});

	it("size보다 1개 더 오면 hasNext=true, 초과분 트리밍 후 nextCursor를 마지막 항목 id로 설정한다", async () => {
		// Given - size 2 요청, 저장소가 다음 페이지 확인용 1개 더(3개) 반환
		repository.findManyByUserId.mockResolvedValue([
			memoEntity(30),
			memoEntity(20),
			memoEntity(10),
		]);

		// When
		const result = await useCase.execute({ userId: "user-1", size: 2 });

		// Then
		expect(result.items).toHaveLength(2);
		expect(result.items.map((m) => m.id)).toEqual([30, 20]);
		expect(result.pagination.hasNext).toBe(true);
		expect(result.pagination.nextCursor).toBe(20);
	});

	it("size 이하로 오면 hasNext=false, nextCursor=null이다 (마지막 페이지)", async () => {
		// Given
		repository.findManyByUserId.mockResolvedValue([
			memoEntity(2),
			memoEntity(1),
		]);

		// When
		const result = await useCase.execute({ userId: "user-1", size: 5 });

		// Then
		expect(result.items).toHaveLength(2);
		expect(result.pagination.hasNext).toBe(false);
		expect(result.pagination.nextCursor).toBeNull();
	});

	it("저장소가 내려준 고정 우선 정렬 순서를 그대로 보존한다", async () => {
		// Given - 저장소가 pinned desc → sortOrder desc 순으로 내려줌
		repository.findManyByUserId.mockResolvedValue([
			memoEntity(5, true),
			memoEntity(9, false),
			memoEntity(1, false),
		]);

		// When
		const result = await useCase.execute({ userId: "user-1", size: 10 });

		// Then - use-case는 재정렬하지 않고 순서를 보존
		expect(result.items.map((m) => m.id)).toEqual([5, 9, 1]);
		expect(result.items.map((m) => m.isPinned)).toEqual([true, false, false]);
	});
});
