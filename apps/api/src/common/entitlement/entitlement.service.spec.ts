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
import {
	AI_PARSE_LIMITS,
	CHEER_LIMITS,
	FOLLOW_LIMITS,
	NUDGE_LIMITS,
	TODO_CATEGORY_LIMITS,
} from "@aido/validators";
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { CacheService } from "@/common/cache/cache.service";
import {
	BusinessException,
	BusinessExceptions,
} from "@/common/exception/services/business-exception.service";
import { DatabaseService } from "@/database/database.service";

import {
	EntitlementService,
	Feature,
	type FeatureEntitlement,
	Resource,
	type ResourceEntitlement,
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
		cacheService = unitRef.get(CacheService);
		database = unitRef.get(DatabaseService);
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
				(cacheService.wrapSubscription as jest.Mock).mockResolvedValue({
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
				(cacheService.wrapSubscription as jest.Mock).mockResolvedValue({
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
				(cacheService.wrapSubscription as jest.Mock).mockResolvedValue({
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
				(cacheService.wrapSubscription as jest.Mock).mockResolvedValue({
					status: "FREE",
					isAdmin: false,
				});

				// When - 기능 제한 조회
				await service.getFeatureLimit(userId, Feature.CHEER);

				// Then - DB 조회 미호출
				expect(database.user.findUnique).not.toHaveBeenCalled();
			});

			it("캐시 미스 시 DB 조회 후 캐싱한다", async () => {
				// Given - wrapSubscription이 팩토리 실행 (캐시 미스 시뮬레이션)
				(cacheService.wrapSubscription as jest.Mock).mockImplementation(
					(_id: string, factory: () => Promise<unknown>) => factory(),
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

				// Then - wrapSubscription 호출 확인 (내부적으로 캐싱 처리)
				expect(cacheService.wrapSubscription).toHaveBeenCalledWith(
					userId,
					expect.any(Function),
				);

				// Then - 올바른 결과 반환
				expect(result).toEqual<FeatureEntitlement>({
					dailyLimit: CHEER_LIMITS.FREE_DAILY_LIMIT,
					isAdmin: false,
					subscriptionStatus: "FREE",
				});
			});

			it("캐시 미스 + DB에 사용자 없으면 기본값(USER/FREE)을 사용한다", async () => {
				// Given - wrapSubscription이 팩토리 실행 (캐시 미스), DB에도 사용자 없음
				(cacheService.wrapSubscription as jest.Mock).mockImplementation(
					(_id: string, factory: () => Promise<unknown>) => factory(),
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
			});

			it("캐시 미스 + DB에 ADMIN 사용자면 isAdmin: true로 캐싱한다", async () => {
				// Given - wrapSubscription이 팩토리 실행 (캐시 미스), DB에 ADMIN 사용자 존재
				(cacheService.wrapSubscription as jest.Mock).mockImplementation(
					(_id: string, factory: () => Promise<unknown>) => factory(),
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
			expect(cacheService.wrapSubscription).not.toHaveBeenCalled();
		});
	});

	// =========================================================================
	// getResourceLimit (리소스 보유량 제한)
	// =========================================================================

	describe("getResourceLimit", () => {
		describe("ADMIN 역할", () => {
			it.each([
				["CATEGORY", Resource.CATEGORY],
				["FRIEND", Resource.FRIEND],
			] as const)("ADMIN은 %s 리소스가 무제한이다", async (_name, resource) => {
				// Given
				(cacheService.wrapSubscription as jest.Mock).mockResolvedValue({
					status: "FREE",
					isAdmin: true,
				});

				// When
				const result = await service.getResourceLimit(userId, resource);

				// Then
				expect(result).toEqual<ResourceEntitlement>({
					maxCount: null,
					isAdmin: true,
					subscriptionStatus: "FREE",
				});
			});
		});

		describe("ACTIVE 구독", () => {
			it("ACTIVE 구독 + FRIEND 리소스는 무제한이다", async () => {
				// Given
				(cacheService.wrapSubscription as jest.Mock).mockResolvedValue({
					status: "ACTIVE",
					isAdmin: false,
				});

				// When
				const result = await service.getResourceLimit(userId, Resource.FRIEND);

				// Then
				expect(result).toEqual<ResourceEntitlement>({
					maxCount: null,
					isAdmin: false,
					subscriptionStatus: "ACTIVE",
				});
			});

			it("ACTIVE 구독 + CATEGORY 리소스는 30개 제한이다", async () => {
				// Given
				(cacheService.wrapSubscription as jest.Mock).mockResolvedValue({
					status: "ACTIVE",
					isAdmin: false,
				});

				// When
				const result = await service.getResourceLimit(
					userId,
					Resource.CATEGORY,
				);

				// Then
				expect(result).toEqual<ResourceEntitlement>({
					maxCount: TODO_CATEGORY_LIMITS.ACTIVE_MAX_COUNT,
					isAdmin: false,
					subscriptionStatus: "ACTIVE",
				});
			});
		});

		describe("비프리미엄 구독 (제한 적용)", () => {
			it.each([
				[
					"FREE",
					"CATEGORY",
					Resource.CATEGORY,
					TODO_CATEGORY_LIMITS.FREE_MAX_COUNT,
				],
				["FREE", "FRIEND", Resource.FRIEND, FOLLOW_LIMITS.FREE_MAX_FRIENDS],
				[
					"CANCELLED",
					"FRIEND",
					Resource.FRIEND,
					FOLLOW_LIMITS.FREE_MAX_FRIENDS,
				],
			] as const)("%s 구독 + %s 리소스는 최대 %d개 제한이다", async (status, _name, resource, expectedLimit) => {
				// Given
				(cacheService.wrapSubscription as jest.Mock).mockResolvedValue({
					status,
					isAdmin: false,
				});

				// When
				const result = await service.getResourceLimit(userId, resource);

				// Then
				expect(result).toEqual<ResourceEntitlement>({
					maxCount: expectedLimit,
					isAdmin: false,
					subscriptionStatus: status,
				});
			});
		});
	});

	// =========================================================================
	// hasPremiumAccess (프리미엄 접근 권한)
	// =========================================================================

	describe("hasPremiumAccess", () => {
		it("ADMIN 역할은 true를 반환한다", async () => {
			// Given
			(cacheService.wrapSubscription as jest.Mock).mockResolvedValue({
				status: "FREE",
				isAdmin: true,
			});

			// When
			const result = await service.hasPremiumAccess(userId);

			// Then
			expect(result).toBe(true);
		});

		it("ACTIVE 구독은 true를 반환한다", async () => {
			// Given
			(cacheService.wrapSubscription as jest.Mock).mockResolvedValue({
				status: "ACTIVE",
				isAdmin: false,
			});

			// When
			const result = await service.hasPremiumAccess(userId);

			// Then
			expect(result).toBe(true);
		});

		it("FREE 구독은 false를 반환한다", async () => {
			// Given
			(cacheService.wrapSubscription as jest.Mock).mockResolvedValue({
				status: "FREE",
				isAdmin: false,
			});

			// When
			const result = await service.hasPremiumAccess(userId);

			// Then
			expect(result).toBe(false);
		});

		it("EXPIRED 구독은 false를 반환한다", async () => {
			// Given
			(cacheService.wrapSubscription as jest.Mock).mockResolvedValue({
				status: "EXPIRED",
				isAdmin: false,
			});

			// When
			const result = await service.hasPremiumAccess(userId);

			// Then
			expect(result).toBe(false);
		});

		it("CANCELLED 구독은 false를 반환한다", async () => {
			// Given
			(cacheService.wrapSubscription as jest.Mock).mockResolvedValue({
				status: "CANCELLED",
				isAdmin: false,
			});

			// When
			const result = await service.hasPremiumAccess(userId);

			// Then
			expect(result).toBe(false);
		});
	});

	// =========================================================================
	// enforceResourceLimit
	// =========================================================================

	describe("enforceResourceLimit", () => {
		const errorFactory = (current: number, limit: number) =>
			BusinessExceptions.todoCategoryFull(current, limit);

		it("maxCount가 null이면 예외를 발생시키지 않는다 (무제한)", () => {
			// When & Then
			expect(() => {
				service.enforceResourceLimit(100, null, errorFactory);
			}).not.toThrow();
		});

		it("currentCount가 maxCount 미만이면 통과한다", () => {
			// When & Then
			expect(() => {
				service.enforceResourceLimit(29, 30, errorFactory);
			}).not.toThrow();
		});

		it("currentCount가 maxCount와 같으면 예외를 발생시킨다", () => {
			// When & Then
			expect(() => {
				service.enforceResourceLimit(30, 30, errorFactory);
			}).toThrow(BusinessException);
		});

		it("currentCount가 maxCount를 초과하면 예외를 발생시킨다", () => {
			// When & Then
			expect(() => {
				service.enforceResourceLimit(31, 30, errorFactory);
			}).toThrow(BusinessException);
		});
	});
});
