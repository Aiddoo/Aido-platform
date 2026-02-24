import {
	AI_PARSE_LIMITS,
	CHEER_LIMITS,
	NUDGE_LIMITS,
	SUBSCRIPTION_AI_PARSE_LIMITS,
	SUBSCRIPTION_CHEER_LIMITS,
	SUBSCRIPTION_NUDGE_LIMITS,
} from "@aido/validators";
import { Injectable } from "@nestjs/common";
import { CacheService } from "@/common/cache/cache.service";
import type { TransactionClient } from "@/common/database";
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
		return { dailyLimit, isAdmin: role === "ADMIN", subscriptionStatus };
	}

	async #resolveUserInfo(
		userId: string,
	): Promise<{ role: string; subscriptionStatus: string }> {
		const cached = await this.cacheService.getSubscription(userId);
		if (cached !== undefined) {
			return {
				role: cached.isAdmin ? "ADMIN" : "USER",
				subscriptionStatus: cached.status ?? "FREE",
			};
		}

		const user = await this.database.user.findUnique({
			where: { id: userId },
			select: { role: true, subscriptionStatus: true },
		});
		const role = user?.role ?? "USER";
		const subscriptionStatus = user?.subscriptionStatus ?? "FREE";

		await this.cacheService.setSubscription(userId, {
			status: user?.subscriptionStatus ?? null,
			isAdmin: role === "ADMIN",
		});

		return { role, subscriptionStatus };
	}
}
