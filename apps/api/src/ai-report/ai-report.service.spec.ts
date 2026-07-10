/**
 * AiReportService 단위 테스트
 *
 * Suites + GWT 패턴 적용
 * - getReportById: 존재하지 않는 리포트 → BusinessExceptions.aiReportNotFound
 * - generateWeeklyReport: 이미 존재하면 skip
 * - generateWeeklyReport: aggregator → generator → repository.create 순서 검증
 */

import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import type { AiReport } from "@/generated/prisma/client";
import { EntitlementService } from "@/shared/application/entitlement/entitlement.service";
import { BusinessException } from "@/shared/application/exceptions/business-exception.service";

import { AiReportRepository } from "./ai-report.repository";
import { AiReportService } from "./ai-report.service";
import { ReportAggregatorService } from "./report-aggregator.service";
import { ReportGeneratorService } from "./report-generator.service";
import type { AggregatedReportData } from "./types";

describe("AiReportService — AI 리포트 서비스", () => {
	let service: AiReportService;
	let mockRepository: Mocked<AiReportRepository>;
	let mockAggregator: Mocked<ReportAggregatorService>;
	let mockGenerator: Mocked<ReportGeneratorService>;
	let mockEntitlementService: Mocked<EntitlementService>;

	const mockUserId = "user-123";
	const mockTimezone = "Asia/Seoul";

	/**
	 * 테스트용 AiReport 엔티티 생성 헬퍼
	 */
	function createMockReportEntity(overrides?: Partial<AiReport>): AiReport {
		return {
			id: 1,
			userId: mockUserId,
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
			categoryBreakdown: [],
			dayPatterns: [],
			timePatterns: [],
			aiSummary: "좋은 한 주였어!",
			aiTips: ["계속 이렇게 해봐!"],
			hasActivity: true,
			generatedAt: new Date("2026-03-09T07:00:00.000Z"),
			createdAt: new Date("2026-03-09T07:00:00.000Z"),
			...overrides,
		} as AiReport;
	}

	/**
	 * 테스트용 집계 데이터 생성 헬퍼
	 */
	function createMockAggregatedData(
		overrides?: Partial<AggregatedReportData>,
	): AggregatedReportData {
		return {
			totalTodos: 10,
			completedTodos: 8,
			completionRate: 80,
			prevCompletionRate: 70,
			streakDays: 3,
			categoryBreakdown: [],
			dayPatterns: [],
			timePatterns: [],
			hasActivity: true,
			...overrides,
		};
	}

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(AiReportService).compile();

		service = unit;
		mockRepository = unitRef.get(AiReportRepository);
		mockAggregator = unitRef.get(ReportAggregatorService);
		mockGenerator = unitRef.get(ReportGeneratorService);
		mockEntitlementService = unitRef.get(EntitlementService);

		// 기본: 프리미엄 사용자
		mockEntitlementService.hasPremiumAccess.mockResolvedValue(true);
	});

	describe("프리미엄 체크", () => {
		it("비프리미엄 사용자가 getReportStatus를 호출하면 AI_1308 예외를 던져야 한다", async () => {
			// Given -비프리미엄 사용자
			mockEntitlementService.hasPremiumAccess.mockResolvedValue(false);

			// When & Then: 프리미엄 필수 예외가 발생해야 한다
			await expect(
				service.getReportStatus(mockUserId, mockTimezone),
			).rejects.toThrow(BusinessException);

			expect(mockRepository.findLatest).not.toHaveBeenCalled();
		});

		it("비프리미엄 사용자가 getReports를 호출하면 AI_1308 예외를 던져야 한다", async () => {
			// Given -비프리미엄 사용자
			mockEntitlementService.hasPremiumAccess.mockResolvedValue(false);

			// When & Then: 프리미엄 필수 예외가 발생해야 한다
			await expect(
				service.getReports(mockUserId, { type: "WEEKLY", limit: 10 }),
			).rejects.toThrow(BusinessException);

			expect(mockRepository.findMany).not.toHaveBeenCalled();
		});

		it("비프리미엄 사용자가 getReportById를 호출하면 AI_1308 예외를 던져야 한다", async () => {
			// Given -비프리미엄 사용자
			mockEntitlementService.hasPremiumAccess.mockResolvedValue(false);

			// When & Then: 프리미엄 필수 예외가 발생해야 한다
			await expect(service.getReportById(mockUserId, 1)).rejects.toThrow(
				BusinessException,
			);

			expect(mockRepository.findByIdAndUserId).not.toHaveBeenCalled();
		});

		it("generateWeeklyReport는 프리미엄 체크 없이 동작해야 한다", async () => {
			// Given -비프리미엄 사용자이지만 크론잡 호출
			mockEntitlementService.hasPremiumAccess.mockResolvedValue(false);
			mockRepository.exists.mockResolvedValue(true);

			// When -generateWeeklyReport를 호출하면
			const result = await service.generateWeeklyReport(
				mockUserId,
				mockTimezone,
			);

			// Then -프리미엄 체크 없이 정상 동작 (이미 존재하므로 null)
			expect(mockEntitlementService.hasPremiumAccess).not.toHaveBeenCalled();
			expect(result).toBeNull();
		});
	});

	describe("getReportStatus", () => {
		it("daysUntil은 시간이 아닌 날짜(calendar day) 기준으로 계산해야 한다", async () => {
			// Given — 일요일 23:00 KST (= 14:00 UTC), 다음 월요일까지 D-1
			jest.useFakeTimers();
			jest.setSystemTime(new Date("2026-03-08T14:00:00Z"));

			// When
			const result = await service.getReportStatus(mockUserId, mockTimezone);

			// Then — 캘린더 기준 1일 (시간 기반이면 0일로 잘못 계산됨)
			expect(result.daysUntilWeekly).toBe(1);

			jest.useRealTimers();
		});

		it("리포트 상태와 최신 리포트를 반환해야 한다", async () => {
			// Given -최신 리포트가 존재하는 상태
			const weeklyReport = createMockReportEntity({ type: "WEEKLY" });
			mockRepository.findLatest.mockImplementation(
				async (_userId: string, type: string) => {
					if (type === "WEEKLY") return weeklyReport;
					return null;
				},
			);

			// When -getReportStatus를 호출하면
			const result = await service.getReportStatus(mockUserId, mockTimezone);

			// Then -다음 리포트 예정일과 최신 리포트를 반환해야 한다
			expect(result.nextWeeklyAt).toBeDefined();
			expect(result.nextMonthlyAt).toBeDefined();
			expect(result.daysUntilWeekly).toBeGreaterThanOrEqual(0);
			expect(result.daysUntilMonthly).toBeGreaterThanOrEqual(0);
			expect(result.latestWeekly).not.toBeNull();
			expect(result.latestMonthly).toBeNull();
			expect(mockRepository.findLatest).toHaveBeenCalledTimes(2);
		});
	});

	describe("getReports", () => {
		it("리포트 목록을 조회하고 DTO로 변환해야 한다", async () => {
			// Given -리포트 목록이 존재
			const reports = [createMockReportEntity()];
			mockRepository.findMany.mockResolvedValue(reports);

			// When -getReports를 호출하면
			const result = await service.getReports(mockUserId, {
				type: "WEEKLY",
				limit: 10,
			});

			// Then -변환된 리포트 목록을 반환해야 한다
			expect(result).toHaveLength(1);
			expect(result[0]?.id).toBe(1);
			expect(mockRepository.findMany).toHaveBeenCalledWith({
				userId: mockUserId,
				type: "WEEKLY",
				limit: 10,
			});
		});
	});

	describe("getReportById", () => {
		it("존재하는 리포트를 조회하면 DTO를 반환해야 한다", async () => {
			// Given -리포트가 존재
			const report = createMockReportEntity({ id: 42 });
			mockRepository.findByIdAndUserId.mockResolvedValue(report);

			// When -getReportById를 호출하면
			const result = await service.getReportById(mockUserId, 42);

			// Then -DTO를 반환해야 한다
			expect(result.id).toBe(42);
			expect(mockRepository.findByIdAndUserId).toHaveBeenCalledWith(
				42,
				mockUserId,
			);
		});

		it("존재하지 않는 리포트 조회 시 aiReportNotFound 예외를 던져야 한다", async () => {
			// Given -리포트가 존재하지 않음
			mockRepository.findByIdAndUserId.mockResolvedValue(null);

			// When & Then: aiReportNotFound 예외가 발생해야 한다
			await expect(service.getReportById(mockUserId, 999)).rejects.toThrow(
				BusinessException,
			);

			expect(mockRepository.findByIdAndUserId).toHaveBeenCalledWith(
				999,
				mockUserId,
			);
		});
	});

	describe("generateWeeklyReport", () => {
		it("이미 존재하는 주간 리포트면 null을 반환해야 한다 (skip)", async () => {
			// Given -해당 주차 리포트가 이미 존재
			mockRepository.exists.mockResolvedValue(true);

			// When -generateWeeklyReport를 호출하면
			const result = await service.generateWeeklyReport(
				mockUserId,
				mockTimezone,
			);

			// Then -null을 반환하고 aggregator/generator가 호출되지 않아야 한다
			expect(result).toBeNull();
			expect(mockAggregator.aggregate).not.toHaveBeenCalled();
			expect(mockGenerator.generate).not.toHaveBeenCalled();
			expect(mockRepository.create).not.toHaveBeenCalled();
		});

		it("aggregator → generator → repository.create 순서로 실행되어야 한다", async () => {
			// Given -리포트가 존재하지 않고 각 서비스가 정상 응답
			mockRepository.exists.mockResolvedValue(false);

			const mockAggregatedData = createMockAggregatedData();
			mockAggregator.aggregate.mockResolvedValue(mockAggregatedData);

			mockGenerator.generate.mockResolvedValue({
				aiSummary: "이번 주 잘했어!",
				aiTips: ["계속 파이팅!"],
			});

			const createdReport = createMockReportEntity();
			mockRepository.create.mockResolvedValue(createdReport);

			// When -generateWeeklyReport를 호출하면
			const result = await service.generateWeeklyReport(
				mockUserId,
				mockTimezone,
			);

			// Then -aggregator → generator → repository.create 순서로 호출되어야 한다
			expect(mockAggregator.aggregate).toHaveBeenCalledTimes(1);
			expect(mockGenerator.generate).toHaveBeenCalledTimes(1);
			expect(mockRepository.create).toHaveBeenCalledTimes(1);
			expect(result).not.toBeNull();
			expect(result?.id).toBe(1);

			// aggregator에 올바른 파라미터가 전달되었는지 검증
			const aggregateArgs = mockAggregator.aggregate.mock.calls[0];
			expect(aggregateArgs).toBeDefined();
			const aggregateCall = aggregateArgs?.[0];
			expect(aggregateCall?.userId).toBe(mockUserId);
			expect(aggregateCall?.timezone).toBe(mockTimezone);
			expect(aggregateCall?.startDate).toBeInstanceOf(Date);
			expect(aggregateCall?.endDate).toBeInstanceOf(Date);

			// generator에 올바른 파라미터가 전달되었는지 검증
			const generateArgs = mockGenerator.generate.mock.calls[0];
			expect(generateArgs).toBeDefined();
			const generateCall = generateArgs?.[0];
			expect(generateCall?.aggregatedData).toEqual(mockAggregatedData);
			expect(generateCall?.type).toBe("WEEKLY");
		});
	});

	describe("generateMonthlyReport", () => {
		it("이미 존재하는 월간 리포트면 null을 반환해야 한다 (skip)", async () => {
			// Given -해당 월 리포트가 이미 존재
			mockRepository.exists.mockResolvedValue(true);

			// When -generateMonthlyReport를 호출하면
			const result = await service.generateMonthlyReport(
				mockUserId,
				mockTimezone,
			);

			// Then -null을 반환하고 aggregator가 호출되지 않아야 한다
			expect(result).toBeNull();
			expect(mockAggregator.aggregate).not.toHaveBeenCalled();
		});

		it("월간 리포트를 정상적으로 생성해야 한다", async () => {
			// Given -리포트가 존재하지 않고 각 서비스가 정상 응답
			mockRepository.exists.mockResolvedValue(false);

			const mockAggregatedData = createMockAggregatedData();
			mockAggregator.aggregate.mockResolvedValue(mockAggregatedData);

			mockGenerator.generate.mockResolvedValue({
				aiSummary: "이번 달 잘했어!",
				aiTips: ["다음 달도 파이팅!"],
			});

			const createdReport = createMockReportEntity({ type: "MONTHLY" });
			mockRepository.create.mockResolvedValue(createdReport);

			// When -generateMonthlyReport를 호출하면
			const result = await service.generateMonthlyReport(
				mockUserId,
				mockTimezone,
			);

			// Then -생성된 리포트를 반환해야 한다
			expect(result).not.toBeNull();
			expect(mockRepository.create).toHaveBeenCalledTimes(1);
		});
	});
});
