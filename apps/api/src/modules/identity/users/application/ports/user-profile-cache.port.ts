import type {
  PremiumSource,
  SubscriptionPlanType,
  SubscriptionStatus,
  UserRole,
} from "@aido/api/vocabulary";

import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { AccountProvider } from "../../../linked-accounts/domain/linked-accounts.constants.js";
import type { UserStatus } from "../../domain/users.constants.js";

export interface CachedUserProfile {
  id: string;
  email: string;
  userTag: string;
  role: UserRole;
  status: UserStatus;
  emailVerifiedAt: string | null;
  subscriptionStatus: SubscriptionStatus;
  subscriptionExpiresAt: string | null;
  name: string | null;
  profileImage: string | null;
  createdAt: string;
  providers: AccountProvider[];
  /** 1.13.0 이전 캐시에는 없다. 없으면 응답에서도 생략한다. */
  premiumSource?: PremiumSource | null;
  premiumEndsAt?: string | null;
  premiumPeriodEndsAt?: string | null;
  willRenew?: boolean;
  bankedPremiumDays?: number;
  premiumGrantEndedAt?: string | null;
  /** 1.15.0 이전 캐시에는 없다. 없으면 응답에서도 생략한다. */
  premiumIsTrial?: boolean;
  premiumPlanType?: SubscriptionPlanType | null;
}

export abstract class UserProfileCachePort {
  abstract wrapUserProfile(
    userId: UserId,
    factory: () => Promise<CachedUserProfile | null>,
  ): Promise<CachedUserProfile | null>;
}
