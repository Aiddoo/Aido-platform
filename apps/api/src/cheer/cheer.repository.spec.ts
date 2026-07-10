/**
 * CheerRepository 단위 테스트
 *
 * Suites + Builder + GWT 패턴 적용
 * - Suites: 자동 Mock 생성
 * - Builder: 테스트 데이터 생성
 * - GWT: Given/When/Then 주석
 *
 * @see https://docs.nestjs.com/recipes/suites
 */

import { TransactionHost } from "@nestjs-cls/transactional";
import type { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import { TestBed } from "@suites/unit";
import { CheerBuilder } from "@test/builders";
import { createMockPrisma, type MockPrismaClient } from "@test/mocks";
import type { DatabaseService } from "@/shared/infrastructure/database/database.service";

import { CheerRepository } from "./cheer.repository";
import type {
	CheckCooldownParams,
	CheckDailyLimitParams,
	FindCheersParams,
} from "./types";

describe("CheerRepository — 응원 리포지토리", () => {
	let repository: CheerRepository;
	let db: MockPrismaClient;

	beforeEach(async () => {
		// ID 카운터 리셋
		CheerBuilder.resetIdCounter();

		// 리포지토리는 CLS TransactionHost.tx에서 클라이언트를 읽으므로
		// tx가 Prisma mock을 반환하도록 스텁합니다.
		db = createMockPrisma();

		const { unit } = await TestBed.solitary(CheerRepository)
			.mock<TransactionHost<TransactionalAdapterPrisma<DatabaseService>>>(
				TransactionHost,
			)
			.impl(() => ({ tx: db }))
			.compile();

		repository = unit;
	});

	describe("findById", () => {
		it("ID로 Cheer를 조회한다", async () => {
			// Given
			const cheerId = 1;
			const expectedCheer = CheerBuilder.create("sender-1", "receiver-1")
				.withId(cheerId)
				.build();
			(db.cheer.findUnique as jest.Mock).mockResolvedValue(expectedCheer);

			// When
			const result = await repository.findById(cheerId);

			// Then
			expect(result).toEqual(expectedCheer);
			expect(db.cheer.findUnique).toHaveBeenCalledWith({
				where: { id: cheerId },
			});
		});

		it("존재하지 않는 ID면 null을 반환한다", async () => {
			// Given
			(db.cheer.findUnique as jest.Mock).mockResolvedValue(null);

			// When
			const result = await repository.findById(999);

			// Then
			expect(result).toBeNull();
		});
	});

	describe("markAsRead", () => {
		it("Cheer를 읽음 처리한다", async () => {
			// Given
			const cheerId = 1;
			const readAt = new Date();
			const expectedCheer = CheerBuilder.create("sender-1", "receiver-1")
				.withId(cheerId)
				.asRead(readAt)
				.build();
			(db.cheer.update as jest.Mock).mockResolvedValue(expectedCheer);

			// When
			const result = await repository.markAsRead(cheerId);

			// Then
			expect(result).toEqual(expectedCheer);
			expect(db.cheer.update).toHaveBeenCalledWith({
				where: { id: cheerId },
				data: { readAt: expect.any(Date) },
			});
		});
	});

	describe("markManyAsRead", () => {
		it("여러 Cheer를 읽음 처리하고 처리된 수를 반환한다", async () => {
			// Given
			const cheerIds = [1, 2, 3];
			const receiverId = "receiver-1";
			(db.cheer.updateMany as jest.Mock).mockResolvedValue({ count: 3 });

			// When
			const result = await repository.markManyAsRead(cheerIds, receiverId);

			// Then
			expect(result).toBe(3);
			expect(db.cheer.updateMany).toHaveBeenCalledWith({
				where: {
					id: { in: cheerIds },
					receiverId,
					readAt: null,
				},
				data: { readAt: expect.any(Date) },
			});
		});

		it("이미 읽은 Cheer는 제외하고 처리한다", async () => {
			// Given
			const cheerIds = [1, 2, 3];
			const receiverId = "receiver-1";
			(db.cheer.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

			// When
			const result = await repository.markManyAsRead(cheerIds, receiverId);

			// Then
			expect(result).toBe(1);
		});
	});

	describe("findReceivedCheers", () => {
		it("받은 Cheer 목록을 조회한다", async () => {
			// Given
			const params: FindCheersParams = {
				userId: "receiver-1",
				size: 10,
			};
			const expectedCheers = [
				CheerBuilder.create("sender-1", params.userId)
					.withId(1)
					.buildWithRelations(),
				CheerBuilder.create("sender-2", params.userId)
					.withId(2)
					.buildWithRelations(),
			];
			(db.cheer.findMany as jest.Mock).mockResolvedValue(expectedCheers);

			// When
			const result = await repository.findReceivedCheers(params);

			// Then
			expect(result).toEqual(expectedCheers);
			expect(db.cheer.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { receiverId: params.userId },
					take: params.size + 1,
					orderBy: [{ createdAt: "desc" }, { id: "desc" }],
				}),
			);
		});

		it("커서가 주어지면 해당 위치부터 조회한다", async () => {
			// Given
			const params: FindCheersParams = {
				userId: "receiver-1",
				cursor: 5,
				size: 10,
			};
			(db.cheer.findMany as jest.Mock).mockResolvedValue([]);

			// When
			await repository.findReceivedCheers(params);

			// Then
			expect(db.cheer.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					skip: 1,
					cursor: { id: params.cursor },
				}),
			);
		});
	});

	describe("findSentCheers", () => {
		it("보낸 Cheer 목록을 조회한다", async () => {
			// Given
			const params: FindCheersParams = {
				userId: "sender-1",
				size: 10,
			};
			const expectedCheers = [
				CheerBuilder.create(params.userId, "receiver-1")
					.withId(1)
					.buildWithRelations(),
				CheerBuilder.create(params.userId, "receiver-2")
					.withId(2)
					.buildWithRelations(),
			];
			(db.cheer.findMany as jest.Mock).mockResolvedValue(expectedCheers);

			// When
			const result = await repository.findSentCheers(params);

			// Then
			expect(result).toEqual(expectedCheers);
			expect(db.cheer.findMany).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { senderId: params.userId },
					take: params.size + 1,
					orderBy: [{ createdAt: "desc" }, { id: "desc" }],
				}),
			);
		});
	});

	describe("countTodayCheers", () => {
		it("오늘 보낸 Cheer 수를 반환한다", async () => {
			// Given
			const params: CheckDailyLimitParams = {
				senderId: "sender-1",
				date: new Date("2024-01-15T15:00:00Z"),
			};
			(db.cheer.count as jest.Mock).mockResolvedValue(3);

			// When
			const result = await repository.countTodayCheers(params);

			// Then
			expect(result).toBe(3);
			expect(db.cheer.count).toHaveBeenCalledWith({
				where: {
					senderId: params.senderId,
					createdAt: {
						gte: expect.any(Date),
						lt: expect.any(Date),
					},
				},
			});
		});

		it("날짜 범위가 해당 날짜의 00:00:00부터 다음날 00:00:00까지이다", async () => {
			// Given
			const testDate = new Date("2024-01-15T15:00:00Z");
			const params: CheckDailyLimitParams = {
				senderId: "sender-1",
				date: testDate,
			};
			(db.cheer.count as jest.Mock).mockResolvedValue(0);

			// When
			await repository.countTodayCheers(params);

			// Then
			const callArgs = (db.cheer.count as jest.Mock).mock.calls[0][0];
			const startDate = callArgs.where.createdAt.gte;
			const endDate = callArgs.where.createdAt.lt;

			expect(startDate.getUTCHours()).toBe(0);
			expect(startDate.getUTCMinutes()).toBe(0);
			expect(startDate.getUTCSeconds()).toBe(0);
			expect(endDate.getUTCDate()).toBe(startDate.getUTCDate() + 1);
			expect(endDate.getUTCHours()).toBe(0);
			expect(endDate.getUTCMinutes()).toBe(0);
			expect(endDate.getUTCSeconds()).toBe(0);
		});
	});

	describe("findLastCheerToUser", () => {
		it("특정 사용자에게 보낸 마지막 Cheer를 반환한다", async () => {
			// Given
			const params: CheckCooldownParams = {
				senderId: "sender-1",
				receiverId: "receiver-1",
			};
			const expectedCheer = CheerBuilder.create(
				params.senderId,
				params.receiverId,
			).build();
			(db.cheer.findFirst as jest.Mock).mockResolvedValue(expectedCheer);

			// When
			const result = await repository.findLastCheerToUser(params);

			// Then
			expect(result).toEqual(expectedCheer);
			expect(db.cheer.findFirst).toHaveBeenCalledWith({
				where: {
					senderId: params.senderId,
					receiverId: params.receiverId,
				},
				orderBy: { createdAt: "desc" },
			});
		});

		it("해당 사용자에게 보낸 Cheer가 없으면 null을 반환한다", async () => {
			// Given
			const params: CheckCooldownParams = {
				senderId: "sender-1",
				receiverId: "receiver-1",
			};
			(db.cheer.findFirst as jest.Mock).mockResolvedValue(null);

			// When
			const result = await repository.findLastCheerToUser(params);

			// Then
			expect(result).toBeNull();
		});
	});
});
