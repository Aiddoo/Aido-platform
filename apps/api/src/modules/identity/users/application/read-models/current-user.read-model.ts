import type {
  PremiumFeature,
  PremiumSource,
  SubscriptionPlanType,
  SubscriptionStatus,
  UserRole,
} from "@aido/api/vocabulary";

import type { FeatureAccess } from "#api/modules/access/access-entitlement.public";

import type { AccountProvider, UserStatus } from "../../../auth/domain/auth.constants.js";

/** 하루·한 달 한도가 있는 기능은 지금까지 쓴 양과 다음 초기화 시각(ISO 문자열)을 함께 둔다 */
interface MeteredFeatureAccess extends FeatureAccess {
  readonly used: number;
  readonly resetsAt: string;
}

/** 출시 앱 /me의 기능별 권한. 1.15.0부터 더한 기능은 GET /v1/entitlements가 준다 */
export type CurrentUserEntitlements = Readonly<Record<PremiumFeature, FeatureAccess>> & {
  readonly AI_PARSE: MeteredFeatureAccess;
  readonly CHEER: MeteredFeatureAccess;
  readonly NUDGE: MeteredFeatureAccess;
};

/** 내 정보. 시각은 프로필 캐시에 담아 온 ISO 문자열이다 */
export interface CurrentUserResult {
  readonly userId: string;
  readonly email: string;
  readonly sessionId: string;
  readonly userTag: string;
  readonly role: UserRole;
  readonly status: UserStatus;
  readonly emailVerifiedAt: string | null;
  readonly subscriptionStatus: SubscriptionStatus;
  readonly subscriptionExpiresAt: string | null;
  readonly name: string | null;
  readonly profileImage: string | null;
  readonly createdAt: string;
  readonly providers: AccountProvider[];
  readonly premiumSource?: PremiumSource | null;
  readonly premiumEndsAt?: string | null;
  readonly premiumPeriodEndsAt?: string | null;
  readonly willRenew?: boolean;
  readonly bankedPremiumDays?: number;
  readonly premiumGrantEndedAt?: string | null;
  readonly premiumIsTrial?: boolean;
  readonly premiumPlanType?: SubscriptionPlanType | null;
  readonly isPremium?: boolean;
  readonly entitlements?: CurrentUserEntitlements;
}
