/**
 * AiSuggestionRepository 단위 테스트
 *
 * Suites + GWT 패턴 적용
 * - 쿼리 파라미터 검증
 */

import { TransactionHost } from "@nestjs-cls/transactional";
import type { TransactionalAdapterPrisma } from "@nestjs-cls/transactional-adapter-prisma";
import { TestBed } from "@suites/unit";
import { createMockPrisma, type MockPrismaClient } from "@test/mocks";
import type { DatabaseService } from "@/database/database.service";

import { AiSuggestionRepository } from "./ai-suggestion.repository";

describe("AiSuggestionRepository — AI 제안 리포지토리", () => {
	let repository: AiSuggestionRepository;
	let db: MockPrismaClient;

	beforeEach(async () => {
		// 리포지토리는 CLS TransactionHost.tx에서 클라이언트를 읽으므로
		// tx가 Prisma mock을 반환하도록 스텁합니다.
		db = createMockPrisma();

		const { unit } = await TestBed.solitary(AiSuggestionRepository)
			.mock<TransactionHost<TransactionalAdapterPrisma<DatabaseService>>>(
				TransactionHost,
			)
			.impl(() => ({ tx: db }))
			.compile();

		repository = unit;
	});

	describe("findPendingByUserId", () => {
		it("PENDING 상태이고 만료되지 않은 제안을 조회해야 한다", async () => {
			// Given -조회할 제안 목록
			const mockSuggestions = [{ id: 1, status: "PENDING" }];
			(db.recurringSuggestion.findMany as jest.Mock).mockResolvedValue(
				mockSuggestions,
			);

			// When -findPendingByUserId를 호출하면
			const result = await repository.findPendingByUserId("user-123");

			// Then -올바른 where 조건으로 조회해야 한다
			expect(db.recurringSuggestion.findMany).toHaveBeenCalledWith({
				where: {
					userId: "user-123",
					status: "PENDING",
					expiresAt: { gt: expect.any(Date) },
				},
				orderBy: { createdAt: "desc" },
			});
			expect(result).toEqual(mockSuggestions);
		});
	});

	describe("findByIdAndUserId", () => {
		it("ID와 userId로 제안을 조회해야 한다", async () => {
			// Given -조회할 제안
			const mockSuggestion = { id: 1, userId: "user-123" };
			(db.recurringSuggestion.findFirst as jest.Mock).mockResolvedValue(
				mockSuggestion,
			);

			// When -findByIdAndUserId를 호출하면
			const result = await repository.findByIdAndUserId(1, "user-123");

			// Then -올바른 where 조건으로 조회해야 한다
			expect(db.recurringSuggestion.findFirst).toHaveBeenCalledWith({
				where: { id: 1, userId: "user-123" },
			});
			expect(result).toEqual(mockSuggestion);
		});

		it("존재하지 않는 제안은 null을 반환해야 한다", async () => {
			// Given -제안이 없는 상태
			(db.recurringSuggestion.findFirst as jest.Mock).mockResolvedValue(null);

			// When -findByIdAndUserId를 호출하면
			const result = await repository.findByIdAndUserId(999, "user-123");

			// Then -null을 반환해야 한다
			expect(result).toBeNull();
		});
	});

	describe("updateStatus", () => {
		it("제안 상태를 업데이트해야 한다", async () => {
			// Given -업데이트할 제안
			const mockUpdated = { id: 1, status: "ACCEPTED" };
			(db.recurringSuggestion.update as jest.Mock).mockResolvedValue(
				mockUpdated,
			);

			// When -updateStatus를 호출하면
			const result = await repository.updateStatus(1, "ACCEPTED");

			// Then -올바른 where/data로 업데이트해야 한다
			expect(db.recurringSuggestion.update).toHaveBeenCalledWith({
				where: { id: 1 },
				data: { status: "ACCEPTED" },
			});
			expect(result).toEqual(mockUpdated);
		});
	});

	describe("create", () => {
		it("제안을 생성하고 결과를 반환해야 한다", async () => {
			// Given -생성할 제안 데이터
			const createData = {
				user: { connect: { id: "user-123" } },
				title: "팀 미팅",
				daysOfWeek: ["MON", "WED", "FRI"],
				scheduledTime: "10:00",
				confidence: 0.85,
				reason: "이유",
				matchedTodos: [],
				expiresAt: new Date(),
			};
			const mockSuggestion = { id: 1, ...createData };
			(db.recurringSuggestion.create as jest.Mock).mockResolvedValue(
				mockSuggestion,
			);

			// When -create를 호출하면
			const result = await repository.create(createData as never);

			// Then -Prisma create에 올바른 데이터를 전달해야 한다
			expect(db.recurringSuggestion.create).toHaveBeenCalledWith({
				data: createData,
			});
			expect(result).toEqual(mockSuggestion);
		});
	});

	describe("createMany", () => {
		it("여러 제안을 한 번에 생성해야 한다", async () => {
			// Given -생성할 데이터 배열
			const data = [
				{
					userId: "user-123",
					title: "운동",
					daysOfWeek: ["MON"],
					scheduledTime: null,
					confidence: 0.8,
					reason: "이유",
					matchedTodos: [],
					expiresAt: new Date(),
				},
				{
					userId: "user-123",
					title: "독서",
					daysOfWeek: ["TUE"],
					scheduledTime: null,
					confidence: 0.7,
					reason: "이유",
					matchedTodos: [],
					expiresAt: new Date(),
				},
			];
			(db.recurringSuggestion.createMany as jest.Mock).mockResolvedValue({
				count: 2,
			});

			// When -createMany를 호출하면
			const result = await repository.createMany(data as never);

			// Then -Prisma createMany에 올바른 데이터를 전달해야 한다
			expect(db.recurringSuggestion.createMany).toHaveBeenCalledWith({
				data,
			});
			expect(result).toEqual({ count: 2 });
		});
	});

	describe("deletePending", () => {
		it("사용자의 PENDING 제안을 전부 삭제해야 한다", async () => {
			// Given -삭제할 PENDING 제안이 존재
			(db.recurringSuggestion.deleteMany as jest.Mock).mockResolvedValue({
				count: 3,
			});

			// When -deletePending을 호출하면
			const result = await repository.deletePending("user-123");

			// Then -userId와 PENDING 조건으로 삭제해야 한다
			expect(db.recurringSuggestion.deleteMany).toHaveBeenCalledWith({
				where: { userId: "user-123", status: "PENDING" },
			});
			expect(result).toEqual({ count: 3 });
		});
	});

	describe("deleteExpired", () => {
		it("만료된 제안을 삭제해야 한다", async () => {
			// Given -삭제할 만료 제안
			(db.recurringSuggestion.deleteMany as jest.Mock).mockResolvedValue({
				count: 3,
			});

			// When -deleteExpired를 호출하면
			const result = await repository.deleteExpired("user-123");

			// Then -올바른 조건으로 삭제해야 한다
			expect(db.recurringSuggestion.deleteMany).toHaveBeenCalledWith({
				where: {
					userId: "user-123",
					expiresAt: { lt: expect.any(Date) },
				},
			});
			expect(result).toEqual({ count: 3 });
		});
	});

	describe("findRecentTodos", () => {
		it("비반복 할 일만 조회하고 요약 형식으로 반환해야 한다", async () => {
			// Given -최근 할 일 목록 (scheduledTime은 UTC 저장, Asia/Seoul은 +9)
			const from = new Date("2026-02-04T00:00:00.000Z");
			const to = new Date("2026-03-04T00:00:00.000Z");
			const mockTodos = [
				{
					title: "팀 미팅",
					startDate: new Date("2026-02-10T00:00:00.000Z"),
					scheduledTime: new Date("2026-02-10T01:00:00.000Z"), // UTC 01:00 → KST 10:00
					categoryId: 3,
					completed: true,
					category: { name: "업무" },
				},
				{
					title: "운동",
					startDate: new Date("2026-02-11T00:00:00.000Z"),
					scheduledTime: null,
					categoryId: 5,
					completed: false,
					category: { name: "운동" },
				},
			];
			(db.todo.findMany as jest.Mock).mockResolvedValue(mockTodos);

			// When -findRecentTodos를 호출하면
			const result = await repository.findRecentTodos(
				"user-123",
				from,
				to,
				"Asia/Seoul",
			);

			// Then -비반복 조건으로 조회하고 사용자 타임존 기준 시간을 반환해야 한다
			expect(db.todo.findMany).toHaveBeenCalledWith({
				where: {
					userId: "user-123",
					recurrenceGroupId: null,
					startDate: { gte: from, lte: to },
				},
				select: {
					title: true,
					startDate: true,
					scheduledTime: true,
					categoryId: true,
					completed: true,
					category: { select: { name: true } },
				},
				orderBy: { startDate: "asc" },
			});
			expect(result).toHaveLength(2);
			expect(result[0]?.title).toBe("팀 미팅");
			expect(result[0]?.scheduledTime).toBe("10:00");
			expect(result[0]?.categoryId).toBe(3);
			expect(result[0]?.completed).toBe(true);
			expect(result[0]?.categoryName).toBe("업무");
			expect(result[1]?.scheduledTime).toBeNull();
			expect(result[1]?.categoryId).toBe(5);
			expect(result[1]?.completed).toBe(false);
			expect(result[1]?.categoryName).toBe("운동");
		});
	});
});
