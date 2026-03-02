import {
	AI_PARSE_LIMITS,
	CHEER_LIMITS,
	FOLLOW_LIMITS,
	NUDGE_LIMITS,
	SUBSCRIPTION_AI_PARSE_LIMITS,
	SUBSCRIPTION_CHEER_LIMITS,
	SUBSCRIPTION_FOLLOW_LIMITS,
	SUBSCRIPTION_NUDGE_LIMITS,
	SUBSCRIPTION_TODO_CATEGORY_LIMITS,
	TODO_CATEGORY_LIMITS,
} from "@aido/validators";
import { Injectable } from "@nestjs/common";
import { CacheService } from "@/common/cache/cache.service";
import type { TransactionClient } from "@/common/database";
import type { BusinessException } from "@/common/exception/services/business-exception.service";
import { DatabaseService } from "@/database/database.service";

export const Feature = {
	CHEER: "CHEER",
	NUDGE: "NUDGE",
	AI_PARSE: "AI_PARSE",
} as const;
export type Feature = (typeof Feature)[keyof typeof Feature];

const FEATURE_LIMITS: Record<Feature, Record<string, number | null>> = {
	CHEER: { ...SUBSCRIPTION_CHEER_LIMITS },
	NUDGE: { ...SUBSCRIPTION_NUDGE_LIMITS },
	AI_PARSE: { ...SUBSCRIPTION_AI_PARSE_LIMITS },
};

const FEATURE_FREE_DEFAULTS: Record<Feature, number> = {
	CHEER: CHEER_LIMITS.FREE_DAILY_LIMIT,
	NUDGE: NUDGE_LIMITS.FREE_DAILY_LIMIT,
	AI_PARSE: AI_PARSE_LIMITS.FREE_DAILY_LIMIT,
};

// =========================================================================
// 리소스 제한 (총 보유량)
// =========================================================================

export const Resource = {
	CATEGORY: "CATEGORY",
	FRIEND: "FRIEND",
} as const;
export type Resource = (typeof Resource)[keyof typeof Resource];

const RESOURCE_LIMITS: Record<Resource, Record<string, number | null>> = {
	CATEGORY: { ...SUBSCRIPTION_TODO_CATEGORY_LIMITS },
	FRIEND: { ...SUBSCRIPTION_FOLLOW_LIMITS },
};

const RESOURCE_FREE_DEFAULTS: Record<Resource, number> = {
	CATEGORY: TODO_CATEGORY_LIMITS.FREE_MAX_COUNT,
	FRIEND: FOLLOW_LIMITS.FREE_MAX_FRIENDS,
};

function resolveResourceLimit(
	role: string,
	subscriptionStatus: string,
	resource: Resource,
): number | null {
	if (role === "ADMIN") return null;
	const limits = RESOURCE_LIMITS[resource];
	if (subscriptionStatus in limits) {
		return limits[subscriptionStatus] as number | null;
	}
	return RESOURCE_FREE_DEFAULTS[resource];
}

function resolveFeatureLimit(
	role: string,
	subscriptionStatus: string,
	feature: Feature,
): number | null {
	if (role === "ADMIN") return null;
	const limits = FEATURE_LIMITS[feature];
	if (subscriptionStatus in limits) {
		return limits[subscriptionStatus] as number | null;
	}
	return FEATURE_FREE_DEFAULTS[feature];
}

export interface FeatureEntitlement {
	dailyLimit: number | null;
	isAdmin: boolean;
	subscriptionStatus: string;
}

export interface ResourceEntitlement {
	maxCount: number | null;
	isAdmin: boolean;
	subscriptionStatus: string;
}

/**
 * 기능 접근 권한(Entitlement) 판단 서비스
 *
 * - ADMIN 역할 → 항상 무제한
 * - ACTIVE 구독 → 무제한
 * - 그 외 → 구독 상태별 제한 적용
 *
 * 캐시 우선 조회 (getLimitInfo 등 읽기 전용 경로) 와
 * 트랜잭션 내 실시간 조회 (TOCTOU 방지) 를 분리합니다.
 */
@Injectable()
export class EntitlementService {
	constructor(
		private readonly cacheService: CacheService,
		private readonly database: DatabaseService,
	) {}

	/**
	 * 캐시 우선 조회 (읽기 전용 경로)
	 *
	 * getLimitInfo 등 조회 API에서 사용
	 */
	async getFeatureLimit(
		userId: string,
		feature: Feature,
	): Promise<FeatureEntitlement> {
		const { role, subscriptionStatus } = await this.#resolveUserInfo(userId);
		const dailyLimit = resolveFeatureLimit(role, subscriptionStatus, feature);
		return { dailyLimit, isAdmin: role === "ADMIN", subscriptionStatus };
	}

	/**
	 * 트랜잭션 내 실시간 조회 (쓰기 경로)
	 *
	 * sendCheer/sendNudge 등 TOCTOU 방지가 필요한 곳에서 사용
	 */
	async getFeatureLimitInTx(
		tx: TransactionClient,
		userId: string,
		feature: Feature,
	): Promise<FeatureEntitlement> {
		const user = await tx.user.findUnique({
			where: { id: userId },
			select: { role: true, subscriptionStatus: true },
		});
		const role = user?.role ?? "USER";
		const subscriptionStatus = user?.subscriptionStatus ?? "FREE";
		const dailyLimit = resolveFeatureLimit(role, subscriptionStatus, feature);
		return {
			dailyLimit,
			isAdmin: role === "ADMIN",
			subscriptionStatus,
		};
	}

	/**
	 * 기능 사용 한도를 검증하고, 초과 시 예외를 발생시킵니다.
	 */
	enforceLimit(
		entitlement: FeatureEntitlement,
		currentUsage: number,
		errorFactory: (used: number, limit: number) => BusinessException,
	): void {
		if (entitlement.dailyLimit === null) return;
		if (currentUsage < entitlement.dailyLimit) return;

		throw errorFactory(currentUsage, entitlement.dailyLimit);
	}

	// =========================================================================
	// 리소스 제한 (총 보유량)
	// =========================================================================

	/**
	 * 리소스 보유량 제한 정보를 조회합니다. (캐시 우선)
	 *
	 * 일일 사용량(Feature)이 아닌 총 보유량(Resource) 제한에 사용합니다.
	 */
	async getResourceLimit(
		userId: string,
		resource: Resource,
	): Promise<ResourceEntitlement> {
		const { role, subscriptionStatus } = await this.#resolveUserInfo(userId);
		const maxCount = resolveResourceLimit(role, subscriptionStatus, resource);
		return { maxCount, isAdmin: role === "ADMIN", subscriptionStatus };
	}

	/**
	 * 리소스 보유량 제한을 검증하고, 초과 시 예외를 발생시킵니다.
	 */
	enforceResourceLimit(
		currentCount: number,
		maxCount: number | null,
		errorFactory: (current: number, limit: number) => BusinessException,
	): void {
		if (maxCount === null) return;
		if (currentCount < maxCount) return;

		throw errorFactory(currentCount, maxCount);
	}

	// =========================================================================
	// 프리미엄 접근 권한
	// =========================================================================

	/**
	 * 프리미엄 기능 접근 가능 여부 확인 (ADMIN 또는 ACTIVE 구독)
	 */
	async hasPremiumAccess(userId: string): Promise<boolean> {
		const { role, subscriptionStatus } = await this.#resolveUserInfo(userId);
		return role === "ADMIN" || subscriptionStatus === "ACTIVE";
	}

	// =========================================================================
	// 공통 유틸리티
	// =========================================================================

	/**
	 * 잔여 횟수를 계산합니다.
	 */
	calculateRemaining(dailyLimit: number | null, used: number): number | null {
		if (dailyLimit === null) return null;
		return Math.max(0, dailyLimit - used);
	}

	async #resolveUserInfo(
		userId: string,
	): Promise<{ role: string; subscriptionStatus: string }> {
		const cached = await this.cacheService.wrapSubscription(
			userId,
			async () => {
				const user = await this.database.user.findUnique({
					where: { id: userId },
					select: { role: true, subscriptionStatus: true },
				});
				return {
					status: user?.subscriptionStatus ?? null,
					isAdmin: (user?.role ?? "USER") === "ADMIN",
				};
			},
		);

		return {
			role: cached?.isAdmin ? "ADMIN" : "USER",
			subscriptionStatus: cached?.status ?? "FREE",
		};
	}
}
