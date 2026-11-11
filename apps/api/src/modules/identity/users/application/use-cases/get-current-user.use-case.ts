import { ErrorCode } from "@aido/api/errors";
import { PREMIUM_FEATURE_KEYS } from "@aido/api/vocabulary";
import { pick } from "es-toolkit";

import type { EntitlementReaderPort } from "#api/modules/access/entitlements/access-entitlements.public";
import type { QuotaLedgerPort } from "#api/modules/access/quotas/access-quotas.public";
import type { PremiumAccessReaderPort } from "#api/modules/billing/premium-grants/billing-premium-grants.public";
import type { DailySendUsageReaderPort } from "#api/modules/social/cheers/social-cheers.public";
import { ApplicationException } from "#api/shared/application/application.exception";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { instantFromDate, toIsoString } from "#api/shared/domain/time/instant";

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

// billing 프리미엄 조회 포트가 아직 Date를 돌려준다
function dateToIsoStringOrNull(date: Date | null): string | null {
  return date == null ? null : toIsoString(instantFromDate(date));
}

export class GetCurrentUserUseCase {
  readonly #dependencies: GetCurrentUserDependencies;

  constructor(dependencies: GetCurrentUserDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: GetCurrentUserQuery): Promise<CurrentUserResult> {
    const { sessionId } = input;
    const userId = UserId.reconstitute(input.userId);
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
          premiumEndsAt: dateToIsoStringOrNull(premiumAccess.endsAt),
          premiumPeriodEndsAt: dateToIsoStringOrNull(premiumAccess.periodEndsAt),
          willRenew: premiumAccess.willRenew,
          bankedPremiumDays: premiumAccess.bankedDays,
          premiumGrantEndedAt: dateToIsoStringOrNull(premiumAccess.recentGrantEndedAt),
          premiumIsTrial: premiumAccess.isTrial,
          premiumPlanType: premiumAccess.planType,
        };
      },
    );

    if (cachedProfile == null) {
      throw new ApplicationException(ErrorCode.USER_0601, { userId: input.userId });
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
    userId: UserId,
    timezone: string,
  ): Promise<{ isPremium: boolean; entitlements: CurrentUserEntitlements }> {
    const { entitlementReader, quotaLedger, cheerUsageReader, nudgeUsageReader } =
      this.#dependencies;
    const [userEntitlements, aiUsage, cheerUsage, nudgeUsage] = await Promise.all([
      entitlementReader.getEntitlements(userId),
      quotaLedger.read(userId, "AI_PARSE"),
      cheerUsageReader.readDailyUsage(userId, timezone),
      nudgeUsageReader.readDailyUsage(userId, timezone),
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
          resetsAt: toIsoString(instantFromDate(cheerUsage.resetsAt)),
        },
        NUDGE: {
          ...features.NUDGE,
          used: nudgeUsage.used,
          resetsAt: toIsoString(instantFromDate(nudgeUsage.resetsAt)),
        },
      },
    };
  }
}
