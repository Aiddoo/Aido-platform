/**
 * AiReportRepository 단위 테스트
 *
 * Suites + GWT 패턴 적용
 * - 쿼리 파라미터 검증
 * - tx 파라미터 위임 검증
 */

import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { DatabaseService } from "@/database/database.service";

import { AiReportRepository } from "./ai-report.repository";

describe("AiReportRepository", () => {
	let repository: AiReportRepository;
	let db: Mocked<DatabaseService>;

	beforeEach(async () => {
		const { unit, unitRef } =
			await TestBed.solitary(AiReportRepository).compile();

		repository = unit;
		db = unitRef.get(DatabaseService);
	});

	// =========================================================================
	// create
	// =========================================================================

	describe("create", () => {
		it("리포트를 생성하고 결과를 반환해야 한다", async () => {
			// Given -생성할 리포트 데이터
			const createData = {
				user: { connect: { id: "user-123" } },
				type: "WEEKLY" as const,
				year: 2026,
				period: 10,
				stats: {},
				categoryBreakdown: [],
				dayPatterns: [],
				timePatterns: [],
				aiSummary: "요약",
				aiTips: [],
				hasActivity: true,
				generatedAt: new Date(),
			};
			const mockReport = { id: 1, ...createData };
			(db.aiReport.create as jest.Mock).mockResolvedValue(mockReport);

			// When -create를 호출하면
			const result = await repository.create(createData as never);

			// Then -Prisma create에 올바른 데이터를 전달해야 한다
			expect(db.aiReport.create).toHaveBeenCalledWith({ data: createData });
			expect(result).toEqual(mockReport);
		});

		it("트랜잭션 클라이언트가 제공되면 tx를 사용해야 한다", async () => {
			// Given -트랜잭션 클라이언트가 있는 상태
			const mockTx = {
				aiReport: {
					create: jest.fn().mockResolvedValue({ id: 1 }),
				},
			};

			// When -tx를 전달하여 create를 호출하면
			await repository.create({} as never, mockTx as never);

			// Then -tx의 aiReport.create를 사용해야 한다
			expect(mockTx.aiReport.create).toHaveBeenCalled();
			expect(db.aiReport.create).not.toHaveBeenCalled();
		});
	});

	// =========================================================================
	// findByIdAndUserId
	// =========================================================================

	describe("findByIdAndUserId", () => {
		it("ID와 userId로 리포트를 조회해야 한다", async () => {
			// Given -조회할 리포트
			const mockReport = { id: 42, userId: "user-123" };
			(db.aiReport.findFirst as jest.Mock).mockResolvedValue(mockReport);

			// When -findByIdAndUserId를 호출하면
			const result = await repository.findByIdAndUserId(42, "user-123");

			// Then -올바른 where 조건으로 조회해야 한다
			expect(db.aiReport.findFirst).toHaveBeenCalledWith({
				where: { id: 42, userId: "user-123" },
			});
			expect(result).toEqual(mockReport);
		});

		it("존재하지 않는 리포트는 null을 반환해야 한다", async () => {
			// Given -리포트가 없는 상태
			(db.aiReport.findFirst as jest.Mock).mockResolvedValue(null);

			// When -findByIdAndUserId를 호출하면
			const result = await repository.findByIdAndUserId(999, "user-123");

			// Then -null을 반환해야 한다
			expect(result).toBeNull();
		});
	});

	// =========================================================================
	// findLatest
	// =========================================================================

	describe("findLatest", () => {
		it("최신 리포트를 타입별로 조회해야 한다", async () => {
			// Given -최신 리포트
			const mockReport = { id: 1, type: "WEEKLY" };
			(db.aiReport.findFirst as jest.Mock).mockResolvedValue(mockReport);

			// When -findLatest를 호출하면
			const result = await repository.findLatest("user-123", "WEEKLY");

			// Then -올바른 조건과 정렬로 조회해야 한다
			expect(db.aiReport.findFirst).toHaveBeenCalledWith({
				where: { userId: "user-123", type: "WEEKLY" },
				orderBy: { generatedAt: "desc" },
			});
			expect(result).toEqual(mockReport);
		});
	});

	// =========================================================================
	// findMany
	// =========================================================================

	describe("findMany", () => {
		it("타입 필터를 적용하여 목록을 조회해야 한다", async () => {
			// Given -타입 필터가 있는 조회 파라미터
			const params = { userId: "user-123", type: "WEEKLY" as const, limit: 10 };
			(db.aiReport.findMany as jest.Mock).mockResolvedValue([]);

			// When -findMany를 호출하면
			await repository.findMany(params);

			// Then -타입 필터가 적용된 조건으로 조회해야 한다
			expect(db.aiReport.findMany).toHaveBeenCalledWith({
				where: { userId: "user-123", type: "WEEKLY" },
				orderBy: { generatedAt: "desc" },
				take: 10,
			});
		});

		it("타입 필터 없이 전체 조회할 수 있어야 한다", async () => {
			// Given -타입 필터가 없는 조회 파라미터
			const params = { userId: "user-123", limit: 10 };
			(db.aiReport.findMany as jest.Mock).mockResolvedValue([]);

			// When -findMany를 호출하면
			await repository.findMany(params);

			// Then -type 없이 조회해야 한다
			expect(db.aiReport.findMany).toHaveBeenCalledWith({
				where: { userId: "user-123" },
				orderBy: { generatedAt: "desc" },
				take: 10,
			});
		});
	});

	// =========================================================================
	// exists
	// =========================================================================

	describe("exists", () => {
		it("리포트가 존재하면 true를 반환해야 한다", async () => {
			// Given -리포트가 존재
			(db.aiReport.count as jest.Mock).mockResolvedValue(1);

			// When -exists를 호출하면
			const result = await repository.exists("user-123", "WEEKLY", 2026, 10);

			// Then -true를 반환하고 올바른 조건으로 조회해야 한다
			expect(result).toBe(true);
			expect(db.aiReport.count).toHaveBeenCalledWith({
				where: {
					userId: "user-123",
					type: "WEEKLY",
					year: 2026,
					period: 10,
				},
			});
		});

		it("리포트가 존재하지 않으면 false를 반환해야 한다", async () => {
			// Given -리포트가 없음
			(db.aiReport.count as jest.Mock).mockResolvedValue(0);

			// When -exists를 호출하면
			const result = await repository.exists("user-123", "WEEKLY", 2026, 10);

			// Then -false를 반환해야 한다
			expect(result).toBe(false);
		});
	});
});
