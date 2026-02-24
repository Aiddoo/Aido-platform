/**
 * EntitlementService 단위 테스트
 *
 * Suites + GWT 패턴 적용
 * - Suites: 자동 Mock 생성 (CacheService, DatabaseService)
 * - GWT: Given/When/Then 주석
 *
 * 테스트 범위:
 * - getFeatureLimit: 캐시 우선 조회 경로 (ADMIN/USER, 구독 상태별, 캐시 히트/미스)
 * - getFeatureLimitInTx: 트랜잭션 내 실시간 조회 경로
 */
import { AI_PARSE_LIMITS, CHEER_LIMITS, NUDGE_LIMITS } from "@aido/validators";
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { CacheService } from "@/common/cache/cache.service";
import { DatabaseService } from "@/database/database.service";

import {
	EntitlementService,
	Feature,
	type FeatureEntitlement,
} from "./entitlement.service";

// =============================================================================
// Test Suite
// =============================================================================

describe("EntitlementService", () => {
	let service: EntitlementService;
	let cacheService: Mocked<CacheService>;
	let database: Mocked<DatabaseService>;

	const userId = "user-test-123";

	beforeEach(async () => {
		const { unit, unitRef } =
			await TestBed.solitary(EntitlementService).compile();

		service = unit;
		cacheService = unitRef.get(CacheService) as unknown as Mocked<CacheService>;
		database = unitRef.get(
			DatabaseService,
		) as unknown as Mocked<DatabaseService>;
	});

	// =========================================================================
	// getFeatureLimit (캐시 우선 조회)
	// =========================================================================

	describe("getFeatureLimit", () => {
		describe("ADMIN 역할", () => {
			it.each([
				["CHEER", Feature.CHEER],
				["NUDGE", Feature.NUDGE],
				["AI_PARSE", Feature.AI_PARSE],
			] as const)("ADMIN은 %s 기능이 무제한이다", async (_name, feature) => {
				// Given - 캐시에 ADMIN 사용자 정보 존재
				(cacheService.getSubscription as jest.Mock).mockResolvedValue({
					status: "FREE",
					isAdmin: true,
				});

				// When
				const result = await service.getFeatureLimit(userId, feature);

				// Then - ADMIN은 항상 무제한
				expect(result).toEqual<FeatureEntitlement>({
					dailyLimit: null,
					isAdmin: true,
					subscriptionStatus: "FREE",
				});
			});
		});

		describe("USER 역할 + ACTIVE 구독 (무제한)", () => {
			it.each([
				["CHEER", Feature.CHEER],
				["NUDGE", Feature.NUDGE],
				["AI_PARSE", Feature.AI_PARSE],
			] as const)("ACTIVE 구독 + %s 기능은 무제한이다", async (_name, feature) => {
				// Given - 캐시에 ACTIVE 구독 사용자 정보 존재
				(cacheService.getSubscription as jest.Mock).mockResolvedValue({
					status: "ACTIVE",
					isAdmin: false,
				});

				// When
				const result = await service.getFeatureLimit(userId, feature);

				// Then - ACTIVE 구독은 무제한
				expect(result).toEqual<FeatureEntitlement>({
					dailyLimit: null,
					isAdmin: false,
					subscriptionStatus: "ACTIVE",
				});
			});
		});

		describe("USER 역할 + 비프리미엄 구독 (제한 적용)", () => {
			it.each([
				["FREE", "CHEER", Feature.CHEER, CHEER_LIMITS.FREE_DAILY_LIMIT],
				["FREE", "NUDGE", Feature.NUDGE, NUDGE_LIMITS.FREE_DAILY_LIMIT],
				[
					"FREE",
					"AI_PARSE",
					Feature.AI_PARSE,
					AI_PARSE_LIMITS.FREE_DAILY_LIMIT,
				],
				["EXPIRED", "CHEER", Feature.CHEER, CHEER_LIMITS.FREE_DAILY_LIMIT],
				["EXPIRED", "NUDGE", Feature.NUDGE, NUDGE_LIMITS.FREE_DAILY_LIMIT],
				[
					"EXPIRED",
					"AI_PARSE",
					Feature.AI_PARSE,
					AI_PARSE_LIMITS.FREE_DAILY_LIMIT,
				],
				["CANCELLED", "CHEER", Feature.CHEER, CHEER_LIMITS.FREE_DAILY_LIMIT],
				["CANCELLED", "NUDGE", Feature.NUDGE, NUDGE_LIMITS.FREE_DAILY_LIMIT],
				[
					"CANCELLED",
					"AI_PARSE",
					Feature.AI_PARSE,
					AI_PARSE_LIMITS.FREE_DAILY_LIMIT,
				],
			] as const)("%s 구독 + %s 기능은 일일 %d회 제한이다", async (status, _featureName, feature, expectedLimit) => {
				// Given
				(cacheService.getSubscription as jest.Mock).mockResolvedValue({
					status,
					isAdmin: false,
				});

				// When
				const result = await service.getFeatureLimit(userId, feature);

				// Then
				expect(result).toEqual<FeatureEntitlement>({
					dailyLimit: expectedLimit,
					isAdmin: false,
					subscriptionStatus: status,
				});
			});
		});

		describe("캐시 동작", () => {
			it("캐시 히트 시 DB 조회를 하지 않는다", async () => {
				// Given - 캐시에 데이터 존재 (히트)
				(cacheService.getSubscription as jest.Mock).mockResolvedValue({
					status: "FREE",
					isAdmin: false,
				});

				// When - 기능 제한 조회
				await service.getFeatureLimit(userId, Feature.CHEER);

				// Then - DB 조회 미호출
				expect(database.user.findUnique).not.toHaveBeenCalled();
			});

			it("캐시 미스 시 DB 조회 후 캐싱한다", async () => {
				// Given - 캐시 미스 (undefined 반환), DB에 사용자 존재
				(cacheService.getSubscription as jest.Mock).mockResolvedValue(
					undefined,
				);
				(database.user.findUnique as jest.Mock).mockResolvedValue({
					role: "USER",
					subscriptionStatus: "FREE",
				});

				// When - 기능 제한 조회
				const result = await service.getFeatureLimit(userId, Feature.CHEER);

				// Then - DB 조회 확인
				expect(database.user.findUnique).toHaveBeenCalledWith({
					where: { id: userId },
					select: { role: true, subscriptionStatus: true },
				});

				// Then - 캐시에 저장 확인
				expect(cacheService.setSubscription).toHaveBeenCalledWith(userId, {
					status: "FREE",
					isAdmin: false,
				});

				// Then - 올바른 결과 반환
				expect(result).toEqual<FeatureEntitlement>({
					dailyLimit: CHEER_LIMITS.FREE_DAILY_LIMIT,
					isAdmin: false,
					subscriptionStatus: "FREE",
				});
			});

			it("캐시 미스 + DB에 사용자 없으면 기본값(USER/FREE)을 사용한다", async () => {
				// Given - 캐시 미스, DB에도 사용자 없음
				(cacheService.getSubscription as jest.Mock).mockResolvedValue(
					undefined,
				);
				(database.user.findUnique as jest.Mock).mockResolvedValue(null);

				// When - CHEER 기능 제한 조회
				const result = await service.getFeatureLimit(userId, Feature.CHEER);

				// Then - 기본값(FREE) 적용으로 일일 제한
				expect(result).toEqual<FeatureEntitlement>({
					dailyLimit: CHEER_LIMITS.FREE_DAILY_LIMIT,
					isAdmin: false,
					subscriptionStatus: "FREE",
				});

				// Then - 기본값으로 캐싱
				expect(cacheService.setSubscription).toHaveBeenCalledWith(userId, {
					status: null,
					isAdmin: false,
				});
			});

			it("캐시 미스 + DB에 ADMIN 사용자면 isAdmin: true로 캐싱한다", async () => {
				// Given - 캐시 미스, DB에 ADMIN 사용자 존재
				(cacheService.getSubscription as jest.Mock).mockResolvedValue(
					undefined,
				);
				(database.user.findUnique as jest.Mock).mockResolvedValue({
					role: "ADMIN",
					subscriptionStatus: "FREE",
				});

				// When - 기능 제한 조회
				const result = await service.getFeatureLimit(userId, Feature.CHEER);

				// Then - ADMIN 무제한
				expect(result).toEqual<FeatureEntitlement>({
					dailyLimit: null,
					isAdmin: true,
					subscriptionStatus: "FREE",
				});

				// Then - isAdmin: true로 캐싱
				expect(cacheService.setSubscription).toHaveBeenCalledWith(userId, {
					status: "FREE",
					isAdmin: true,
				});
			});
		});
	});

	// =========================================================================
	// getFeatureLimitInTx (트랜잭션 내 조회)
	// =========================================================================

	describe("getFeatureLimitInTx", () => {
		let txMock: {
			user: {
				findUnique: jest.Mock;
			};
		};

		beforeEach(() => {
			txMock = {
				user: {
					findUnique: jest.fn(),
				},
			};
		});

		it("ADMIN 사용자 + NUDGE 기능은 무제한이다", async () => {
			// Given - 트랜잭션 내 ADMIN 사용자
			txMock.user.findUnique.mockResolvedValue({
				role: "ADMIN",
				subscriptionStatus: "FREE",
			});

			// When - 트랜잭션 내 NUDGE 기능 제한 조회
			const result = await service.getFeatureLimitInTx(
				txMock as never,
				userId,
				Feature.NUDGE,
			);

			// Then - ADMIN은 무제한
			expect(result).toEqual<FeatureEntitlement>({
				dailyLimit: null,
				isAdmin: true,
				subscriptionStatus: "FREE",
			});
		});

		it("ADMIN 사용자 + AI_PARSE 기능은 무제한이다", async () => {
			// Given - 트랜잭션 내 ADMIN 사용자
			txMock.user.findUnique.mockResolvedValue({
				role: "ADMIN",
				subscriptionStatus: "FREE",
			});

			// When - 트랜잭션 내 AI_PARSE 기능 제한 조회
			const result = await service.getFeatureLimitInTx(
				txMock as never,
				userId,
				Feature.AI_PARSE,
			);

			// Then - ADMIN은 무제한
			expect(result).toEqual<FeatureEntitlement>({
				dailyLimit: null,
				isAdmin: true,
				subscriptionStatus: "FREE",
			});
		});

		it("USER + FREE 구독 + CHEER 기능은 일일 제한이 적용된다", async () => {
			// Given - 트랜잭션 내 FREE 구독 일반 사용자
			txMock.user.findUnique.mockResolvedValue({
				role: "USER",
				subscriptionStatus: "FREE",
			});

			// When - 트랜잭션 내 CHEER 기능 제한 조회
			const result = await service.getFeatureLimitInTx(
				txMock as never,
				userId,
				Feature.CHEER,
			);

			// Then - FREE는 일일 제한 적용
			expect(result).toEqual<FeatureEntitlement>({
				dailyLimit: CHEER_LIMITS.FREE_DAILY_LIMIT,
				isAdmin: false,
				subscriptionStatus: "FREE",
			});

			// Then - 올바른 쿼리 호출 확인
			expect(txMock.user.findUnique).toHaveBeenCalledWith({
				where: { id: userId },
				select: { role: true, subscriptionStatus: true },
			});
		});

		it("USER + FREE 구독 + AI_PARSE 기능은 일일 제한이 적용된다", async () => {
			// Given - 트랜잭션 내 FREE 구독 일반 사용자
			txMock.user.findUnique.mockResolvedValue({
				role: "USER",
				subscriptionStatus: "FREE",
			});

			// When - 트랜잭션 내 AI_PARSE 기능 제한 조회
			const result = await service.getFeatureLimitInTx(
				txMock as never,
				userId,
				Feature.AI_PARSE,
			);

			// Then - FREE는 일일 제한 적용
			expect(result).toEqual<FeatureEntitlement>({
				dailyLimit: AI_PARSE_LIMITS.FREE_DAILY_LIMIT,
				isAdmin: false,
				subscriptionStatus: "FREE",
			});

			// Then - 올바른 쿼리 호출 확인
			expect(txMock.user.findUnique).toHaveBeenCalledWith({
				where: { id: userId },
				select: { role: true, subscriptionStatus: true },
			});
		});

		it("사용자가 null인 경우 기본값(USER/FREE)을 사용한다", async () => {
			// Given - 트랜잭션 내 사용자 없음
			txMock.user.findUnique.mockResolvedValue(null);

			// When - 트랜잭션 내 CHEER 기능 제한 조회
			const result = await service.getFeatureLimitInTx(
				txMock as never,
				userId,
				Feature.CHEER,
			);

			// Then - 기본값(USER/FREE) 적용으로 일일 제한
			expect(result).toEqual<FeatureEntitlement>({
				dailyLimit: CHEER_LIMITS.FREE_DAILY_LIMIT,
				isAdmin: false,
				subscriptionStatus: "FREE",
			});
		});

		it("캐시를 사용하지 않고 트랜잭션으로 직접 조회한다", async () => {
			// Given - 트랜잭션 내 사용자 존재
			txMock.user.findUnique.mockResolvedValue({
				role: "USER",
				subscriptionStatus: "ACTIVE",
			});

			// When - 트랜잭션 내 조회
			await service.getFeatureLimitInTx(txMock as never, userId, Feature.CHEER);

			// Then - 캐시 서비스 미호출 (TOCTOU 방지)
			expect(cacheService.getSubscription).not.toHaveBeenCalled();
			expect(cacheService.setSubscription).not.toHaveBeenCalled();
		});
	});
});
