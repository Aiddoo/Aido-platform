/**
 * MemoService 단위 테스트
 *
 * Suites + Builder + GWT 패턴 적용
 * - Suites: TestBed.solitary()로 자동 Mock 생성
 * - Builder: MemoBuilder로 테스트 데이터 생성
 * - GWT: Given/When/Then 주석으로 테스트 구조 명확화
 */

import { MEMO_LIMITS } from "@aido/validators";
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { MemoBuilder } from "@test/builders";
import { CacheService } from "@/common/cache/cache.service";
import { PaginationService } from "@/common/pagination";
import { DatabaseService } from "@/database/database.service";
import { TodoService } from "@/modules/todo/todo.service";
import { MemoRepository } from "./memo.repository";
import { MemoService } from "./memo.service";

describe("MemoService — 메모 서비스", () => {
	let service: MemoService;
	let memoRepo: Mocked<MemoRepository>;
	let database: Mocked<DatabaseService>;
	let todoService: Mocked<TodoService>;
	let cacheService: Mocked<CacheService>;
	let _paginationService: Mocked<PaginationService>;

	const mockUserId = "user-123";

	beforeEach(async () => {
		// Given - ID 카운터 리셋으로 테스트 간 격리 보장
		MemoBuilder.resetIdCounter();

		const { unit, unitRef } = await TestBed.solitary(MemoService).compile();

		service = unit;
		memoRepo = unitRef.get(MemoRepository);
		database = unitRef.get(DatabaseService);
		todoService = unitRef.get(TodoService);
		cacheService = unitRef.get(CacheService);
		_paginationService = unitRef.get(PaginationService);

		// Given - 기본 transaction mock 설정
		(database.$transaction as jest.Mock).mockImplementation(
			(callback: (tx: unknown) => Promise<unknown>) => callback({}),
		);
	});

	describe("create", () => {
		it("최대 sortOrder + 1로 새 메모를 생성해야 한다", async () => {
			// Given - 현재 5개 메모, 최대 sortOrder 3
			(memoRepo.countByUserId as jest.Mock).mockResolvedValue(5);
			(memoRepo.getMaxSortOrder as jest.Mock).mockResolvedValue(3);
			const expectedMemo = MemoBuilder.create(mockUserId)
				.withSortOrder(4)
				.build();
			(memoRepo.create as jest.Mock).mockResolvedValue(expectedMemo);

			// When
			const result = await service.create({
				userId: mockUserId,
				content: "새 메모",
			});

			// Then
			expect(result.message).toBeDefined();
			expect(result.memo).toBeDefined();
			expect(memoRepo.create).toHaveBeenCalledWith(
				expect.objectContaining({ sortOrder: 4 }),
				expect.anything(),
			);
		});

		it("20개 초과 시 memoLimitExceeded 에러를 던져야 한다", async () => {
			// Given - 이미 20개 메모 존재
			(memoRepo.countByUserId as jest.Mock).mockResolvedValue(
				MEMO_LIMITS.MAX_PER_USER,
			);

			// When & Then
			await expect(
				service.create({ userId: mockUserId, content: "초과 메모" }),
			).rejects.toThrow();
		});
	});

	describe("getResourceLimitInfo", () => {
		it("현재 메모 개수와 최대 한도를 반환해야 한다", async () => {
			// Given
			(memoRepo.countByUserId as jest.Mock).mockResolvedValue(7);

			// When
			const result = await service.getResourceLimitInfo(mockUserId);

			// Then
			expect(result).toEqual({
				currentCount: 7,
				maxPerUser: MEMO_LIMITS.MAX_PER_USER,
			});
		});
	});

	describe("findOne", () => {
		it("메모를 조회하고 매핑된 결과를 반환해야 한다", async () => {
			// Given - 조회 대상 메모가 존재할 때
			const memo = MemoBuilder.create(mockUserId)
				.withContent("테스트 메모")
				.build();
			(memoRepo.findByIdAndUserId as jest.Mock).mockResolvedValue(memo);

			// When - findOne을 호출하면
			const result = await service.findOne(mockUserId, memo.id);

			// Then - 매핑된 메모를 반환해야 한다
			expect(result.memo).toBeDefined();
			expect(memoRepo.findByIdAndUserId).toHaveBeenCalledWith(
				memo.id,
				mockUserId,
			);
		});

		it("메모가 없으면 에러를 던져야 한다", async () => {
			// Given - 메모가 존재하지 않을 때
			(memoRepo.findByIdAndUserId as jest.Mock).mockResolvedValue(null);

			// When & Then
			await expect(service.findOne(mockUserId, 999)).rejects.toThrow();
		});
	});

	describe("update", () => {
		it("메모 내용을 수정해야 한다", async () => {
			// Given
			const memo = MemoBuilder.create(mockUserId).build();
			(memoRepo.findByIdAndUserId as jest.Mock).mockResolvedValue(memo);
			const updatedMemo = MemoBuilder.create(mockUserId)
				.withId(memo.id)
				.withContent("수정된 내용")
				.build();
			(memoRepo.update as jest.Mock).mockResolvedValue(updatedMemo);

			// When
			const result = await service.update(mockUserId, memo.id, {
				content: "수정된 내용",
			});

			// Then
			expect(result.message).toBeDefined();
			expect(result.memo).toBeDefined();
			expect(memoRepo.update).toHaveBeenCalledWith(memo.id, {
				content: "수정된 내용",
			});
		});

		it("메모가 없으면 에러를 던져야 한다", async () => {
			// Given
			(memoRepo.findByIdAndUserId as jest.Mock).mockResolvedValue(null);

			// When & Then
			await expect(
				service.update(mockUserId, 999, { content: "test" }),
			).rejects.toThrow();
		});
	});

	describe("togglePin", () => {
		it("메모를 고정해야 한다", async () => {
			// Given
			const memo = MemoBuilder.create(mockUserId).build();
			(memoRepo.findByIdAndUserId as jest.Mock).mockResolvedValue(memo);
			const pinnedMemo = MemoBuilder.create(mockUserId)
				.withId(memo.id)
				.pinned()
				.build();
			(memoRepo.update as jest.Mock).mockResolvedValue(pinnedMemo);

			// When
			const result = await service.togglePin(mockUserId, memo.id, true);

			// Then
			expect(result.message).toBeDefined();
			expect(result.memo).toBeDefined();
			expect(memoRepo.update).toHaveBeenCalledWith(memo.id, {
				isPinned: true,
			});
		});

		it("메모가 없으면 에러를 던져야 한다", async () => {
			// Given
			(memoRepo.findByIdAndUserId as jest.Mock).mockResolvedValue(null);

			// When & Then
			await expect(service.togglePin(mockUserId, 999, true)).rejects.toThrow();
		});
	});

	describe("reorder", () => {
		it("targetMemoId가 자기 자신이면 그대로 반환해야 한다", async () => {
			// Given
			const memo = MemoBuilder.create(mockUserId).withSortOrder(2).build();
			(memoRepo.findByIdAndUserId as jest.Mock).mockResolvedValue(memo);

			// When
			const result = await service.reorder(memo.id, mockUserId, {
				targetMemoId: memo.id,
				position: "before",
			});

			// Then
			expect(result.message).toBeDefined();
			expect(result.memo).toBeDefined();
			expect(memoRepo.shiftSortOrders).not.toHaveBeenCalled();
			expect(memoRepo.updateSortOrder).not.toHaveBeenCalled();
		});

		it("기준 메모 앞으로 이동해야 한다", async () => {
			// Given - memo(id=1, sortOrder=3)를 target(id=2, sortOrder=1) 앞으로 이동
			const memo = MemoBuilder.create(mockUserId).withSortOrder(3).build();
			const targetMemo = MemoBuilder.create(mockUserId)
				.withSortOrder(1)
				.build();
			(memoRepo.findByIdAndUserId as jest.Mock)
				.mockResolvedValueOnce(memo)
				.mockResolvedValueOnce(targetMemo);
			(memoRepo.shiftSortOrders as jest.Mock).mockResolvedValue(1);
			const reorderedMemo = MemoBuilder.create(mockUserId)
				.withId(memo.id)
				.withSortOrder(1)
				.build();
			(memoRepo.updateSortOrder as jest.Mock).mockResolvedValue(reorderedMemo);

			// When
			const result = await service.reorder(memo.id, mockUserId, {
				targetMemoId: targetMemo.id,
				position: "before",
			});

			// Then
			expect(result.message).toBeDefined();
			expect(memoRepo.shiftSortOrders).toHaveBeenCalled();
			expect(memoRepo.updateSortOrder).toHaveBeenCalled();
		});

		it("기준 메모가 없으면 에러를 던져야 한다", async () => {
			// Given
			(memoRepo.findByIdAndUserId as jest.Mock).mockResolvedValue(null);

			// When & Then
			await expect(
				service.reorder(999, mockUserId, {
					targetMemoId: 1,
					position: "before",
				}),
			).rejects.toThrow();
		});
	});

	describe("delete", () => {
		it("메모를 삭제해야 한다", async () => {
			// Given
			const memo = MemoBuilder.create(mockUserId).build();
			(memoRepo.findByIdAndUserId as jest.Mock).mockResolvedValue(memo);
			(memoRepo.delete as jest.Mock).mockResolvedValue(memo);

			// When
			const result = await service.delete(mockUserId, memo.id);

			// Then
			expect(result.message).toBeDefined();
			expect(memoRepo.delete).toHaveBeenCalledWith(memo.id);
		});

		it("메모가 없으면 에러를 던져야 한다", async () => {
			// Given
			(memoRepo.findByIdAndUserId as jest.Mock).mockResolvedValue(null);

			// When & Then
			await expect(service.delete(mockUserId, 999)).rejects.toThrow();
		});
	});

	describe("convertToTodo", () => {
		const convertData = {
			categoryId: 1,
			startDate: new Date("2024-01-15"),
			isAllDay: true,
			visibility: "PUBLIC" as const,
		};

		it("메모를 할 일로 변환하고 메모를 삭제해야 한다", async () => {
			// Given
			const memo = MemoBuilder.create(mockUserId)
				.withContent("할 일로 변환할 메모")
				.build();
			(memoRepo.findByIdAndUserId as jest.Mock).mockResolvedValue(memo);
			(todoService.create as jest.Mock).mockResolvedValue({
				id: 1,
				title: "할 일로 변환할 메모",
			});
			(memoRepo.delete as jest.Mock).mockResolvedValue(memo);

			// When
			const result = await service.convertToTodo(
				mockUserId,
				memo.id,
				convertData,
			);

			// Then
			expect(result.message).toBeDefined();
			expect(result.todo).toBeDefined();
			expect(todoService.create).toHaveBeenCalledWith(
				expect.objectContaining({
					userId: mockUserId,
					title: "할 일로 변환할 메모",
				}),
			);
			expect(memoRepo.delete).toHaveBeenCalledWith(memo.id);
		});

		it("200자 초과 메모는 title이 200자로 잘려야 한다", async () => {
			// Given - 200자 초과 메모
			const longContent = "가".repeat(201);
			const memo = MemoBuilder.create(mockUserId)
				.withContent(longContent)
				.build();
			(memoRepo.findByIdAndUserId as jest.Mock).mockResolvedValue(memo);
			(todoService.create as jest.Mock).mockResolvedValue({
				id: 1,
				title: longContent.substring(0, 200),
			});
			(memoRepo.delete as jest.Mock).mockResolvedValue(memo);

			// When
			await service.convertToTodo(mockUserId, memo.id, convertData);

			// Then
			expect(todoService.create).toHaveBeenCalledWith(
				expect.objectContaining({
					title: longContent.substring(0, 200),
				}),
			);
			expect(todoService.create).toHaveBeenCalledWith(
				expect.not.objectContaining({
					content: expect.anything(),
				}),
			);
		});

		it("메모가 없으면 에러를 던져야 한다", async () => {
			// Given
			(memoRepo.findByIdAndUserId as jest.Mock).mockResolvedValue(null);

			// When & Then
			await expect(
				service.convertToTodo(mockUserId, 999, convertData),
			).rejects.toThrow();
		});
	});

	describe("convertToTodos", () => {
		const todosData = {
			todos: [
				{
					title: "버그 수정",
					categoryId: 1,
					startDate: new Date("2026-04-12"),
					isAllDay: false,
					scheduledTime: new Date("2026-04-12T05:00:00Z"),
					items: [{ title: "로그 확인" }],
				},
				{
					title: "스터디 자료 올리기",
					categoryId: 1,
					startDate: new Date("2026-04-17"),
					isAllDay: true,
				},
			],
		};

		it("메모를 여러 할 일로 변환하고 메모를 삭제해야 한다", async () => {
			// Given
			const memo = MemoBuilder.create(mockUserId)
				.withContent("버그 수정, 스터디 자료")
				.build();
			(memoRepo.findByIdAndUserId as jest.Mock).mockResolvedValue(memo);
			(todoService.create as jest.Mock)
				.mockResolvedValueOnce({ id: 1, title: "버그 수정" })
				.mockResolvedValueOnce({ id: 2, title: "스터디 자료 올리기" });
			(memoRepo.delete as jest.Mock).mockResolvedValue(memo);

			// When
			const result = await service.convertToTodos(
				mockUserId,
				memo.id,
				todosData,
			);

			// Then
			expect(result.todos).toHaveLength(2);
			expect(result.message).toContain("2개");
			expect(todoService.create).toHaveBeenCalledTimes(2);
			expect(memoRepo.delete).toHaveBeenCalledWith(memo.id);
		});

		it("반복 일정은 createRecurring을 호출해야 한다", async () => {
			// Given
			const memo = MemoBuilder.create(mockUserId)
				.withContent("매주 수요일 학원")
				.build();
			(memoRepo.findByIdAndUserId as jest.Mock).mockResolvedValue(memo);
			(todoService.createRecurring as jest.Mock).mockResolvedValue({
				todos: [
					{ id: 10, title: "학원" },
					{ id: 11, title: "학원" },
				],
				count: 2,
			});
			(memoRepo.delete as jest.Mock).mockResolvedValue(memo);

			// When
			const result = await service.convertToTodos(mockUserId, memo.id, {
				todos: [
					{
						title: "학원",
						categoryId: 1,
						startDate: new Date("2026-04-15"),
						isAllDay: true,
						isRecurring: true,
						recurrence: {
							daysOfWeek: ["WED"],
							endDate: new Date("2026-05-08"),
						},
					},
				],
			});

			// Then
			expect(todoService.createRecurring).toHaveBeenCalledTimes(1);
			expect(result.todos).toHaveLength(2);
		});

		it("완료 후 카테고리 캐시를 무효화해야 한다", async () => {
			// Given
			const memo = MemoBuilder.create(mockUserId).withContent("테스트").build();
			(memoRepo.findByIdAndUserId as jest.Mock).mockResolvedValue(memo);
			(todoService.create as jest.Mock).mockResolvedValue({
				id: 1,
				title: "테스트",
			});
			(memoRepo.delete as jest.Mock).mockResolvedValue(memo);

			// When
			await service.convertToTodos(mockUserId, memo.id, {
				todos: [
					{
						title: "테스트",
						categoryId: 1,
						startDate: new Date("2026-04-11"),
						isAllDay: true,
					},
				],
			});

			// Then
			expect(cacheService.invalidateTodoCategories).toHaveBeenCalledWith(
				mockUserId,
			);
		});

		it("메모가 없으면 에러를 던져야 한다", async () => {
			// Given
			(memoRepo.findByIdAndUserId as jest.Mock).mockResolvedValue(null);

			// When & Then
			await expect(
				service.convertToTodos(mockUserId, 999, todosData),
			).rejects.toThrow();
		});
	});
});
