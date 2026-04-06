/**
 * NudgeRepository 단위 테스트
 *
 * Suites + Builder + GWT 패턴 적용
 * - Suites: 자동 Mock 생성
 * - Builder: 테스트 데이터 생성
 * - GWT: Given/When/Then 주석
 *
 * @see https://docs.nestjs.com/recipes/suites
 */

import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { NudgeBuilder } from "@test/builders";
import { DatabaseService } from "@/database/database.service";

import { NudgeRepository } from "./nudge.repository";

describe("NudgeRepository — 찔러보기 리포지토리", () => {
	let repository: NudgeRepository;
	let db: Mocked<DatabaseService>;

	beforeEach(async () => {
		// ID 카운터 리셋
		NudgeBuilder.resetIdCounter();

		const { unit, unitRef } = await TestBed.solitary(NudgeRepository).compile();

		repository = unit;
		db = unitRef.get(DatabaseService);
	});

	describe("findById", () => {
		it("ID로 Nudge를 조회한다", async () => {
			// Given
			const mockNudge = NudgeBuilder.create("sender-id", "receiver-id", 100)
				.withId(1)
				.build();
			(db.nudge.findUnique as jest.Mock).mockResolvedValue(mockNudge);

			// When
			const result = await repository.findById(1);

			// Then
			expect(db.nudge.findUnique).toHaveBeenCalledWith({
				where: { id: 1 },
			});
			expect(result).toEqual(mockNudge);
		});

		it("존재하지 않는 Nudge는 null을 반환한다", async () => {
			// Given
			(db.nudge.findUnique as jest.Mock).mockResolvedValue(null);

			// When
			const result = await repository.findById(999);

			// Then
			expect(result).toBeNull();
		});
	});

	describe("markAsRead", () => {
		it("Nudge를 읽음 처리한다", async () => {
			// Given
			const mockNudge = NudgeBuilder.create("sender-id", "receiver-id", 100)
				.withId(1)
				.asRead()
				.build();
			(db.nudge.update as jest.Mock).mockResolvedValue(mockNudge);

			// When
			const result = await repository.markAsRead(1);

			// Then
			expect(db.nudge.update).toHaveBeenCalledWith({
				where: { id: 1 },
				data: { readAt: expect.any(Date) },
			});
			expect(result.readAt).not.toBeNull();
		});
	});

	describe("findReceivedNudges", () => {
		it("받은 Nudge 목록을 조회한다", async () => {
			// Given
			const mockNudges = [
				NudgeBuilder.create("sender-1", "receiver-id", 100)
					.withId(1)
					.buildWithRelations(),
				NudgeBuilder.create("sender-2", "receiver-id", 101)
					.withId(2)
					.buildWithRelations(),
			];
			(db.nudge.findMany as jest.Mock).mockResolvedValue(mockNudges);

			// When
			const result = await repository.findReceivedNudges({
				userId: "receiver-id",
				size: 20,
			});

			// Then
			expect(db.nudge.findMany).toHaveBeenCalledWith({
				where: { receiverId: "receiver-id" },
				include: expect.objectContaining({
					sender: expect.any(Object),
					receiver: expect.any(Object),
					todo: expect.any(Object),
				}),
				take: 21,
				orderBy: [{ createdAt: "desc" }, { id: "desc" }],
			});
			expect(result).toEqual(mockNudges);
		});

		it("커서 기반 페이지네이션을 적용한다", async () => {
			// Given
			const mockNudges = [
				NudgeBuilder.create("sender-1", "receiver-id", 100)
					.withId(3)
					.buildWithRelations(),
			];
			(db.nudge.findMany as jest.Mock).mockResolvedValue(mockNudges);

			// When
			const result = await repository.findReceivedNudges({
				userId: "receiver-id",
				cursor: 5,
				size: 10,
			});

			// Then
			expect(db.nudge.findMany).toHaveBeenCalledWith({
				where: { receiverId: "receiver-id" },
				include: expect.any(Object),
				take: 11,
				skip: 1,
				cursor: { id: 5 },
				orderBy: [{ createdAt: "desc" }, { id: "desc" }],
			});
			expect(result).toEqual(mockNudges);
		});
	});

	describe("findSentNudges", () => {
		it("보낸 Nudge 목록을 조회한다", async () => {
			// Given
			const mockNudges = [
				NudgeBuilder.create("sender-id", "receiver-1", 100)
					.withId(1)
					.buildWithRelations(),
				NudgeBuilder.create("sender-id", "receiver-2", 101)
					.withId(2)
					.buildWithRelations(),
			];
			(db.nudge.findMany as jest.Mock).mockResolvedValue(mockNudges);

			// When
			const result = await repository.findSentNudges({
				userId: "sender-id",
				size: 20,
			});

			// Then
			expect(db.nudge.findMany).toHaveBeenCalledWith({
				where: { senderId: "sender-id" },
				include: expect.any(Object),
				take: 21,
				orderBy: [{ createdAt: "desc" }, { id: "desc" }],
			});
			expect(result).toEqual(mockNudges);
		});
	});

	describe("countTodayNudges", () => {
		it("오늘 보낸 Nudge 수를 조회한다", async () => {
			// Given
			const today = new Date("2024-01-15T12:00:00Z");
			(db.nudge.count as jest.Mock).mockResolvedValue(3);

			// When
			const result = await repository.countTodayNudges({
				senderId: "sender-id",
				date: today,
			});

			// Then
			expect(db.nudge.count).toHaveBeenCalledWith({
				where: {
					senderId: "sender-id",
					createdAt: {
						gte: expect.any(Date),
						lt: expect.any(Date),
					},
				},
			});
			expect(result).toBe(3);
		});
	});

	describe("findLastNudgeForTodo", () => {
		it("특정 Todo에 대한 마지막 Nudge를 조회한다", async () => {
			// Given
			const mockNudge = NudgeBuilder.create(
				"sender-id",
				"receiver-id",
				100,
			).build();
			(db.nudge.findFirst as jest.Mock).mockResolvedValue(mockNudge);

			// When
			const result = await repository.findLastNudgeForTodo({
				senderId: "sender-id",
				todoId: 100,
			});

			// Then
			expect(db.nudge.findFirst).toHaveBeenCalledWith({
				where: {
					senderId: "sender-id",
					todoId: 100,
				},
				orderBy: { createdAt: "desc" },
			});
			expect(result).toEqual(mockNudge);
		});

		it("Nudge가 없으면 null을 반환한다", async () => {
			// Given
			(db.nudge.findFirst as jest.Mock).mockResolvedValue(null);

			// When
			const result = await repository.findLastNudgeForTodo({
				senderId: "sender-id",
				todoId: 100,
			});

			// Then
			expect(result).toBeNull();
		});
	});

	describe("findLastNudgeToUser", () => {
		it("특정 사용자에게 보낸 마지막 Nudge를 조회한다", async () => {
			// Given
			const mockNudge = NudgeBuilder.create(
				"sender-id",
				"receiver-id",
				100,
			).build();
			(db.nudge.findFirst as jest.Mock).mockResolvedValue(mockNudge);

			// When
			const result = await repository.findLastNudgeToUser(
				"sender-id",
				"receiver-id",
			);

			// Then
			expect(db.nudge.findFirst).toHaveBeenCalledWith({
				where: {
					senderId: "sender-id",
					receiverId: "receiver-id",
				},
				orderBy: { createdAt: "desc" },
			});
			expect(result).toEqual(mockNudge);
		});
	});
});
