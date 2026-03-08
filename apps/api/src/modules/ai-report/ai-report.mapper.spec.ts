/**
 * AiReportMapper 단위 테스트
 *
 * GWT 패턴 적용
 * - periodLabel 형식 검증
 * - dateRange 계산 검증
 * - Entity → DTO 변환 검증
 */

import type { AiReport } from "@/generated/prisma/client";

import { AiReportMapper } from "./ai-report.mapper";

describe("AiReportMapper", () => {
	// =========================================================================
	// computePeriodLabel
	// =========================================================================

	describe("computePeriodLabel", () => {
		it("WEEKLY 타입일 때 '년 주차' 형식으로 반환해야 한다", () => {
			// Given -WEEKLY 타입, 2026년 10주차

			// When -computePeriodLabel을 호출하면
			const result = AiReportMapper.computePeriodLabel("WEEKLY", 2026, 10);

			// Then -"2026년 10주차" 형식이어야 한다
			expect(result).toBe("2026년 10주차");
		});

		it("MONTHLY 타입일 때 '년 월' 형식으로 반환해야 한다", () => {
			// Given -MONTHLY 타입, 2026년 3월

			// When -computePeriodLabel을 호출하면
			const result = AiReportMapper.computePeriodLabel("MONTHLY", 2026, 3);

			// Then -"2026년 3월" 형식이어야 한다
			expect(result).toBe("2026년 3월");
		});

		it("1주차를 올바르게 표현해야 한다", () => {
			// Given -WEEKLY 타입, 2026년 1주차

			// When -computePeriodLabel을 호출하면
			const result = AiReportMapper.computePeriodLabel("WEEKLY", 2026, 1);

			// Then -"2026년 1주차" 형식이어야 한다
			expect(result).toBe("2026년 1주차");
		});
	});

	// =========================================================================
	// computeDateRange
	// =========================================================================

	describe("computeDateRange", () => {
		it("WEEKLY 타입일 때 월요일 ~ 일요일 범위를 반환해야 한다", () => {
			// Given -WEEKLY 타입, 2026년 10주차

			// When -computeDateRange를 호출하면
			const result = AiReportMapper.computeDateRange("WEEKLY", 2026, 10);

			// Then -startDate와 endDate가 YYYY-MM-DD 형식이어야 한다
			expect(result.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
			expect(result.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
			// startDate는 endDate보다 이전이어야 한다
			expect(result.startDate < result.endDate).toBe(true);
		});

		it("MONTHLY 타입일 때 해당 월 1일 ~ 마지막 날 범위를 반환해야 한다", () => {
			// Given -MONTHLY 타입, 2026년 3월

			// When -computeDateRange를 호출하면
			const result = AiReportMapper.computeDateRange("MONTHLY", 2026, 3);

			// Then -3월 1일에 시작하고 3월 31일에 끝나야 한다
			expect(result.startDate).toBe("2026-03-01");
			expect(result.endDate).toBe("2026-03-31");
		});

		it("MONTHLY 타입으로 2월 범위를 올바르게 계산해야 한다 (28일/29일)", () => {
			// Given -MONTHLY 타입, 2026년 2월 (비윤년)

			// When -computeDateRange를 호출하면
			const result = AiReportMapper.computeDateRange("MONTHLY", 2026, 2);

			// Then -2월 1일에 시작하고 2월 28일에 끝나야 한다
			expect(result.startDate).toBe("2026-02-01");
			expect(result.endDate).toBe("2026-02-28");
		});
	});

	// =========================================================================
	// toResponse
	// =========================================================================

	describe("toResponse", () => {
		it("Prisma 엔티티를 올바른 DTO 형식으로 변환해야 한다", () => {
			// Given -Prisma AiReport 엔티티
			const entity: AiReport = {
				id: 42,
				userId: "user-123",
				type: "WEEKLY",
				year: 2026,
				period: 10,
				stats: {
					totalTodos: 10,
					completedTodos: 8,
					completionRate: 80,
					prevCompletionRate: 70,
					streakDays: 3,
				},
				categoryBreakdown: [
					{ name: "업무", color: "#FF0000", total: 5, completed: 4, rate: 80 },
				],
				dayPatterns: [{ day: "MON", total: 3, completed: 2, rate: 67 }],
				timePatterns: [{ hour: 10, count: 5 }],
				aiSummary: "좋은 한 주였어!",
				aiTips: ["계속 이렇게 해봐!"],
				hasActivity: true,
				generatedAt: new Date("2026-03-09T07:00:00.000Z"),
				createdAt: new Date("2026-03-09T07:00:00.000Z"),
			} as AiReport;

			// When -toResponse를 호출하면
			const result = AiReportMapper.toResponse(entity);

			// Then -DTO 형식으로 변환되어야 한다
			expect(result.id).toBe(42);
			expect(result.type).toBe("WEEKLY");
			expect(result.year).toBe(2026);
			expect(result.period).toBe(10);
			expect(result.periodLabel).toBe("2026년 10주차");
			expect(result.dateRange.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
			expect(result.dateRange.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
			expect(result.stats).toEqual({
				totalTodos: 10,
				completedTodos: 8,
				completionRate: 80,
				prevCompletionRate: 70,
				streakDays: 3,
			});
			expect(result.categoryBreakdown).toHaveLength(1);
			expect(result.dayPatterns).toHaveLength(1);
			expect(result.timePatterns).toHaveLength(1);
			expect(result.aiSummary).toBe("좋은 한 주였어!");
			expect(result.aiTips).toEqual(["계속 이렇게 해봐!"]);
			expect(result.hasActivity).toBe(true);
			expect(result.generatedAt).toBe("2026-03-09T07:00:00.000Z");
		});

		it("MONTHLY 타입의 periodLabel을 올바르게 생성해야 한다", () => {
			// Given -MONTHLY 타입 엔티티
			const entity = {
				id: 1,
				userId: "user-123",
				type: "MONTHLY",
				year: 2026,
				period: 3,
				stats: {},
				categoryBreakdown: [],
				dayPatterns: [],
				timePatterns: [],
				aiSummary: "요약",
				aiTips: [],
				hasActivity: false,
				generatedAt: new Date("2026-04-01T00:00:00.000Z"),
				createdAt: new Date("2026-04-01T00:00:00.000Z"),
			} as AiReport;

			// When -toResponse를 호출하면
			const result = AiReportMapper.toResponse(entity);

			// Then -"2026년 3월" 형식이어야 한다
			expect(result.periodLabel).toBe("2026년 3월");
		});
	});

	// =========================================================================
	// toManyResponse
	// =========================================================================

	describe("toManyResponse", () => {
		it("여러 엔티티를 일괄 변환해야 한다", () => {
			// Given -2개의 엔티티
			const entities = [
				{
					id: 1,
					userId: "user-123",
					type: "WEEKLY",
					year: 2026,
					period: 9,
					stats: {},
					categoryBreakdown: [],
					dayPatterns: [],
					timePatterns: [],
					aiSummary: "요약1",
					aiTips: [],
					hasActivity: true,
					generatedAt: new Date("2026-03-02T00:00:00.000Z"),
					createdAt: new Date("2026-03-02T00:00:00.000Z"),
				},
				{
					id: 2,
					userId: "user-123",
					type: "WEEKLY",
					year: 2026,
					period: 10,
					stats: {},
					categoryBreakdown: [],
					dayPatterns: [],
					timePatterns: [],
					aiSummary: "요약2",
					aiTips: [],
					hasActivity: true,
					generatedAt: new Date("2026-03-09T00:00:00.000Z"),
					createdAt: new Date("2026-03-09T00:00:00.000Z"),
				},
			] as AiReport[];

			// When -toManyResponse를 호출하면
			const result = AiReportMapper.toManyResponse(entities);

			// Then -2개의 DTO를 반환해야 한다
			expect(result).toHaveLength(2);
			expect(result[0]?.id).toBe(1);
			expect(result[1]?.id).toBe(2);
		});

		it("빈 배열이면 빈 배열을 반환해야 한다", () => {
			// Given -빈 배열

			// When -toManyResponse를 호출하면
			const result = AiReportMapper.toManyResponse([]);

			// Then -빈 배열을 반환해야 한다
			expect(result).toEqual([]);
		});
	});
});
