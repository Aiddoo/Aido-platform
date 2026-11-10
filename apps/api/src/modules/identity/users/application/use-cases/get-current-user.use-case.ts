import { ErrorCode } from "@aido/api/errors";
import { PREMIUM_FEATURE_KEYS } from "@aido/api/vocabulary";
import { pick } from "es-toolkit";

import type { EntitlementReaderPort } from "#api/modules/access/entitlements/access-entitlements.public";
import type { QuotaLedgerPort } from "#api/modules/access/quotas/access-quotas.public";
import type { PremiumAccessReaderPort } from "#api/modules/billing/subscriptions/billing-subscriptions.public";
import type { DailySendUsageReaderPort } from "#api/modules/social/cheers/social-cheers.public";
import { ApplicationException } from "#api/shared/application/application.exception";
import { toISOString, toISOStringOrNull } from "#api/shared/domain/date/utils/format";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { toIsoString } from "#api/shared/domain/time/instant";

import type { AuthCachePort } from "../../../auth/application/ports/auth-collaboration.port.js";
import type { AuthUserRepositoryPort } from "../../../auth/application/ports/auth-user.repository.port.js";
import type {
  CurrentUserEntitlements,
  CurrentUserResult,
} from "../read-models/current-user.read-model.js";

export interface GetCurrentUserQuery {
  readonly userId: string;
  readonly sessionId: string;
  /** 응원·찌르기 일간 사용량의 하루 기준(X-Timezone) */
  readonly timezone: string;
}

interface GetCurrentUserDependencies {
  readonly userRepository: Pick<AuthUserRepositoryPort, "findByIdWithProfile">;
  readonly cacheService: Pick<AuthCachePort, "wrapUserProfile">;
  readonly premiumAccessReader: Pick<PremiumAccessReaderPort, "getPremiumAccess">;
  readonly entitlementReader: Pick<EntitlementReaderPort, "getEntitlements">;
  readonly quotaLedger: Pick<QuotaLedgerPort, "read">;
  readonly cheerUsageReader: Pick<DailySendUsageReaderPort, "readDailyUsage">;
  readonly nudgeUsageReader: Pick<DailySendUsageReaderPort, "readDailyUsage">;
}

export class GetCurrentUserUseCase {
  readonly #dependencies: GetCurrentUserDependencies;

  constructor(dependencies: GetCurrentUserDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: GetCurrentUserQuery): Promise<CurrentUserResult> {
    const { userId, sessionId } = input;
    const cachedProfile = await this.#dependencies.cacheService.wrapUserProfile(
      userId,
      async () => {
        const user = await this.#dependencies.userRepository.findByIdWithProfile(userId);
        if (user == null) {
          return undefined;
        }
        // 없는 사용자에게 보상·구독 조회를 더 하지 않는다
        const premiumAccess = await this.#dependencies.premiumAccessReader.getPremiumAccess(userId);

        return {
          id: user.id,
          email: user.email,
          role: user.role,
          userTag: user.userTag,
          status: user.status,
          emailVerifiedAt: user.emailVerifiedAt == null ? null : toIsoString(user.emailVerifiedAt),
          subscriptionStatus: user.subscriptionStatus,
          subscriptionExpiresAt:
            user.subscriptionExpiresAt == null ? null : toIsoString(user.subscriptionExpiresAt),
          name: user.profile?.name ?? null,
          profileImage: user.profile?.profileImage ?? null,
          createdAt: toIsoString(user.createdAt),
          providers: user.accounts.map((a) => a.provider),
          premiumSource: premiumAccess.source,
          premiumEndsAt: toISOStringOrNull(premiumAccess.endsAt),
          premiumPeriodEndsAt: toISOStringOrNull(premiumAccess.periodEndsAt),
          willRenew: premiumAccess.willRenew,
          bankedPremiumDays: premiumAccess.bankedDays,
          premiumGrantEndedAt: toISOStringOrNull(premiumAccess.recentGrantEndedAt),
          premiumIsTrial: premiumAccess.isTrial,
          premiumPlanType: premiumAccess.planType,
        };
      },
    );

    if (cachedProfile == null) {
      throw new ApplicationException(ErrorCode.USER_0601, { userId });
    }
    // 만료 경계를 넘긴 프로필 캐시를 쓰지 않도록 권한은 기한을 함께 담은 Access 판단으로 매번 계산한다
    const { isPremium, entitlements } = await this.#entitlements(userId, input.timezone);

    return {
      userId: cachedProfile.id,
      email: cachedProfile.email,
      sessionId,
      role: cachedProfile.role,
      userTag: cachedProfile.userTag,
      status: cachedProfile.status,
      emailVerifiedAt: cachedProfile.emailVerifiedAt,
      subscriptionStatus: cachedProfile.subscriptionStatus,
      subscriptionExpiresAt: cachedProfile.subscriptionExpiresAt,
      name: cachedProfile.name,
      profileImage: cachedProfile.profileImage,
      createdAt: cachedProfile.createdAt,
      providers: cachedProfile.providers,
      premiumSource: cachedProfile.premiumSource,
      premiumEndsAt: cachedProfile.premiumEndsAt,
      premiumPeriodEndsAt: cachedProfile.premiumPeriodEndsAt,
      willRenew: cachedProfile.willRenew,
      bankedPremiumDays: cachedProfile.bankedPremiumDays,
      premiumGrantEndedAt: cachedProfile.premiumGrantEndedAt,
      premiumIsTrial: cachedProfile.premiumIsTrial,
      // 배포 전 캐시(TTL 5분 이하)에는 이 칸이 없어 키 버전을 올리지 않고 모름(null)으로 읽는다
      premiumPlanType: cachedProfile.premiumPlanType ?? null,
      isPremium,
      entitlements,
    };
  }

  async #entitlements(
    userId: string,
    timezone: string,
  ): Promise<{ isPremium: boolean; entitlements: CurrentUserEntitlements }> {
    const { entitlementReader, quotaLedger, cheerUsageReader, nudgeUsageReader } =
      this.#dependencies;
    const owner = UserId.reconstitute(userId);
    const [userEntitlements, aiUsage, cheerUsage, nudgeUsage] = await Promise.all([
      entitlementReader.getEntitlements(owner),
      quotaLedger.read(owner, "AI_PARSE"),
      cheerUsageReader.readDailyUsage(owner, timezone),
      nudgeUsageReader.readDailyUsage(owner, timezone),
    ]);
    // 출시 앱 /me.entitlements 계약의 기능만 담는다. 1.15.0부터 더한 기능은 GET /v1/entitlements가 준다.
    const features = pick(userEntitlements.features, PREMIUM_FEATURE_KEYS);
    return {
      isPremium: userEntitlements.isPremium,
      entitlements: {
        ...features,
        AI_PARSE: { ...features.AI_PARSE, used: aiUsage.used, resetsAt: aiUsage.resetsAt },
        CHEER: {
          ...features.CHEER,
          used: cheerUsage.used,
          resetsAt: toISOString(cheerUsage.resetsAt),
        },
        NUDGE: {
          ...features.NUDGE,
          used: nudgeUsage.used,
          resetsAt: toISOString(nudgeUsage.resetsAt),
        },
      },
    };
  }
}
