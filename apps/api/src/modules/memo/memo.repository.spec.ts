/**
 * MemoRepository 단위 테스트
 *
 * @description
 * MemoRepository의 데이터 접근 메서드를 격리 테스트합니다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test memo.repository
 * ```
 */
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import { DatabaseService } from "@/database";

import { MemoRepository } from "./memo.repository";

describe("MemoRepository — 메모 리포지토리", () => {
	let repository: MemoRepository;
	let db: Mocked<DatabaseService>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(MemoRepository).compile();

		repository = unit;
		db = unitRef.get(DatabaseService);
	});

	describe("findManyByUserId", () => {
		const userId = "user-123";

		it("isPinned desc, sortOrder desc, id desc 순서로 정렬하여 조회해야 한다", async () => {
			// Given - 빈 결과가 준비되었을 때
			(db.memo.findMany as jest.Mock).mockResolvedValue([]);

			// When - findManyByUserId를 호출하면
			await repository.findManyByUserId({
				userId,
				cursor: undefined,
				size: 20,
			});

			// Then - orderBy가 [isPinned desc, sortOrder desc, id desc]이어야 한다
			expect(db.memo.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					orderBy: [
						{ isPinned: "desc" },
						{ sortOrder: "desc" },
						{ id: "desc" },
					],
				}),
			);
		});

		it("take를 size + 1로 설정하여 다음 페이지 존재 여부를 확인해야 한다", async () => {
			// Given - 빈 결과가 준비되었을 때
			(db.memo.findMany as jest.Mock).mockResolvedValue([]);
			const size = 20;

			// When - findManyByUserId를 호출하면
			await repository.findManyByUserId({ userId, cursor: undefined, size });

			// Then - take가 size + 1이어야 한다
			expect(db.memo.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					take: size + 1,
				}),
			);
		});

		it("커서가 없으면 skip과 cursor 없이 조회해야 한다", async () => {
			// Given - 커서 없이 조회할 때
			(db.memo.findMany as jest.Mock).mockResolvedValue([]);

			// When - cursor를 undefined로 호출하면
			await repository.findManyByUserId({
				userId,
				cursor: undefined,
				size: 20,
			});

			// Then - skip과 cursor가 포함되지 않아야 한다
			const calledArgs = (db.memo.findMany as jest.Mock).mock.calls[0][0];
			expect(calledArgs.skip).toBeUndefined();
			expect(calledArgs.cursor).toBeUndefined();
		});

		it("커서가 있으면 skip: 1과 cursor를 설정하여 조회해야 한다", async () => {
			// Given - 커서가 있을 때
			(db.memo.findMany as jest.Mock).mockResolvedValue([]);
			const cursor = 5;

			// When - cursor를 전달하여 호출하면
			await repository.findManyByUserId({ userId, cursor, size: 20 });

			// Then - skip: 1과 cursor: { id: cursor }가 설정되어야 한다
			expect(db.memo.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					skip: 1,
					cursor: { id: cursor },
				}),
			);
		});
	});

	describe("countByUserId", () => {
		it("userId로 메모 개수를 조회해야 한다", async () => {
			// Given - 메모 5개가 존재할 때
			const userId = "user-123";
			(db.memo.count as jest.Mock).mockResolvedValue(5);

			// When - countByUserId를 호출하면
			const result = await repository.countByUserId(userId);

			// Then - where: { userId }로 조회하고 결과를 반환해야 한다
			expect(db.memo.count).toHaveBeenCalledWith({
				where: { userId },
			});
			expect(result).toBe(5);
		});
	});

	describe("shiftSortOrders", () => {
		const userId = "user-123";

		it("gte와 lte 범위로 sortOrder를 증감해야 한다", async () => {
			// Given - updateMany가 2개 행을 업데이트할 때
			(db.memo.updateMany as jest.Mock).mockResolvedValue({ count: 2 });

			// When - shiftSortOrders를 호출하면
			const result = await repository.shiftSortOrders(userId, 3, 7, 1);

			// Then - gte/lte 범위와 increment delta로 updateMany가 호출되어야 한다
			expect(db.memo.updateMany).toHaveBeenCalledWith({
				where: {
					userId,
					sortOrder: {
						gte: 3,
						lte: 7,
					},
				},
				data: { sortOrder: { increment: 1 } },
			});
			expect(result).toBe(2);
		});

		it("toSortOrder가 null이면 lte 조건 없이 조회해야 한다", async () => {
			// Given - updateMany가 3개 행을 업데이트할 때
			(db.memo.updateMany as jest.Mock).mockResolvedValue({ count: 3 });

			// When - toSortOrder를 null로 호출하면
			const result = await repository.shiftSortOrders(userId, 5, null, -1);

			// Then - lte 조건 없이 gte만 설정되어야 한다
			expect(db.memo.updateMany).toHaveBeenCalledWith({
				where: {
					userId,
					sortOrder: {
						gte: 5,
					},
				},
				data: { sortOrder: { increment: -1 } },
			});
			expect(result).toBe(3);
		});
	});

	describe("getMaxSortOrder", () => {
		const userId = "user-123";

		it("가장 큰 sortOrder 값을 반환해야 한다", async () => {
			// Given - 최대 sortOrder가 3일 때
			(db.memo.aggregate as jest.Mock).mockResolvedValue({
				_max: { sortOrder: 3 },
			});

			// When - getMaxSortOrder를 호출하면
			const result = await repository.getMaxSortOrder(userId);

			// Then - aggregate로 _max.sortOrder를 조회하고 결과를 반환해야 한다
			expect(db.memo.aggregate).toHaveBeenCalledWith({
				where: { userId },
				_max: { sortOrder: true },
			});
			expect(result).toBe(3);
		});

		it("메모가 없으면 -1을 반환해야 한다", async () => {
			// Given - 메모가 없어서 _max.sortOrder가 null일 때
			(db.memo.aggregate as jest.Mock).mockResolvedValue({
				_max: { sortOrder: null },
			});

			// When - getMaxSortOrder를 호출하면
			const result = await repository.getMaxSortOrder(userId);

			// Then - -1을 반환해야 한다
			expect(result).toBe(-1);
		});
	});
});
