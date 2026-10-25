import type { PremiumSource } from "@aido/api/vocabulary";
import { maxBy, sortBy, sumBy } from "es-toolkit";

import { addDays, addMilliseconds } from "#api/shared/domain/date/utils/arithmetic";

import type { SubscriptionStatusValue } from "../../aggregates/subscriptions/subscription.aggregate.js";

export type PremiumGrantStatusValue = "BANKED" | "ACTIVE" | "ENDED" | "REVOKED";

/** 보상 기간이 끝나기 이만큼 전에 한 번 안내한다. */
const PREMIUM_GRANT_ENDING_NOTICE_MS = 24 * 60 * 60 * 1000;

/** 스토어 구독 행 중 프리미엄 판단에 필요한 값 */
export interface StoreEntitlement {
  readonly status: SubscriptionStatusValue;
  readonly expiresAt: Date;
}

/** 스토어 구독 행과 그 거래 체인 ID */
export interface StoreSubscriptionEntitlement extends StoreEntitlement {
  readonly revenueCatId: string;
}

/** 프리미엄 보상 기간 중 판단에 필요한 값 */
export interface PremiumGrantTerm {
  readonly id: string;
  readonly status: PremiumGrantStatusValue;
  readonly durationDays: number;
  readonly endsAt: Date | null;
  readonly createdAt: Date;
}

/** 한 사용자의 스토어 구독과 보상 기간 전체 */
export interface PremiumEntitlements {
  readonly storeSubscriptions: readonly StoreEntitlement[];
  readonly premiumGrants: readonly PremiumGrantTerm[];
}

export interface PremiumAccess {
  readonly source: PremiumSource | null;
  readonly endsAt: Date | null;
  readonly willRenew: boolean;
  /** 스토어 구독이 끝나면 이어서 시작할, 쌓아 둔 보상 일수 합계 */
  readonly bankedDays: number;
}

export type PremiumGrantStart =
  | { readonly kind: "bank" }
  | { readonly kind: "activate"; readonly startsAt: Date };

export interface PremiumGrantReconciliation {
  readonly activations: readonly { readonly grantId: string; readonly startsAt: Date }[];
  readonly endedGrantIds: readonly string[];
}

/** 기간 계산은 UTC 달력 기준이다. 2028-02-26 + 7일 = 2028-03-04 */
export function premiumGrantEndsAt(startsAt: Date, durationDays: number): Date {
  return addDays(durationDays, startsAt);
}

/** 웹훅이 방금 판단한 체인 상태. 만료 시각을 비우면 행의 값을 쓰고 null이면 엔타이틀먼트가 없다. */
export interface StoreEventChainState {
  readonly revenueCatId: string;
  readonly status: SubscriptionStatusValue;
  readonly expiresAt?: Date | null;
}

/**
 * TRANSFER는 User projection만 옮기고 구독 행을 남기므로 이미 프리미엄이 아닌 사용자의 다른 체인은 믿지 않는다.
 * 이번 이벤트의 체인은 행 대신 이벤트가 정한 상태로 본다(일반 취소의 grace·환불 즉시 종료).
 */
export function selectTrustedStoreSubscriptions(
  subscriptions: readonly StoreSubscriptionEntitlement[],
  context: {
    readonly userStatus: SubscriptionStatusValue | null;
    readonly eventChain?: StoreEventChainState;
  },
): StoreSubscriptionEntitlement[] {
  const { eventChain } = context;
  return subscriptions.flatMap((subscription) => {
    if (subscription.revenueCatId !== eventChain?.revenueCatId) {
      return context.userStatus === "ACTIVE" ? [subscription] : [];
    }
    if (eventChain.expiresAt === null) return [];
    return [
      {
        revenueCatId: subscription.revenueCatId,
        status: eventChain.status,
        expiresAt: eventChain.expiresAt ?? subscription.expiresAt,
      },
    ];
  });
}

/** 취소했어도 만료 전이면 스토어 엔타이틀먼트가 남아 있다. */
export function isStoreEntitlementValid(subscription: StoreEntitlement, now: Date): boolean {
  return (
    (subscription.status === "ACTIVE" || subscription.status === "CANCELLED") &&
    subscription.expiresAt.getTime() > now.getTime()
  );
}

/** 다음 결제가 예정된 구독. 취소하면 CANCELLED로 바뀐다. */
export function isStoreSubscriptionRenewing(subscription: StoreEntitlement, now: Date): boolean {
  return subscription.status === "ACTIVE" && isStoreEntitlementValid(subscription, now);
}

export function isPremiumGrantActive(grant: PremiumGrantTerm, now: Date): boolean {
  return (
    grant.status === "ACTIVE" && grant.endsAt != null && grant.endsAt.getTime() > now.getTime()
  );
}

export function isPremiumGrantEnded(grant: PremiumGrantTerm, now: Date): boolean {
  return (
    grant.status === "ACTIVE" && grant.endsAt != null && grant.endsAt.getTime() <= now.getTime()
  );
}

/** 보상 기간끼리는 겹치지 않게 마지막 ACTIVE 기간 뒤에 이어 붙인다. */
export function nextPremiumGrantStartsAt(grants: readonly PremiumGrantTerm[], now: Date): Date {
  const lastEndsAt = maxBy(
    grants.filter((grant) => isPremiumGrantActive(grant, now)),
    (grant) => grant.endsAt?.getTime() ?? 0,
  )?.endsAt;
  return lastEndsAt == null || lastEndsAt.getTime() < now.getTime() ? now : lastEndsAt;
}

/** 이 시각 이전에 끝나는 마지막 보상 기간을 지금 안내한다. */
export function premiumGrantEndingNoticeUntil(now: Date): Date {
  return addMilliseconds(PREMIUM_GRANT_ENDING_NOTICE_MS, now);
}

function hasStoreEntitlement(entitlements: PremiumEntitlements, now: Date): boolean {
  return entitlements.storeSubscriptions.some((subscription) =>
    isStoreEntitlementValid(subscription, now),
  );
}

export const PremiumAccessPolicy = {
  /** 프리미엄 = max(유효한 스토어 구독, ACTIVE 보상 기간). 스토어가 유효하면 출처는 STORE다. */
  resolve(entitlements: PremiumEntitlements, now: Date): PremiumAccess {
    const storeEndsAt = entitlements.storeSubscriptions
      .filter((subscription) => isStoreEntitlementValid(subscription, now))
      .map((subscription) => subscription.expiresAt);
    const grantEndsAt = entitlements.premiumGrants.flatMap((grant) =>
      isPremiumGrantActive(grant, now) && grant.endsAt != null ? [grant.endsAt] : [],
    );
    const endsAt = maxBy([...storeEndsAt, ...grantEndsAt], (date) => date.getTime()) ?? null;
    const bankedDays = sumBy(
      entitlements.premiumGrants.filter((grant) => grant.status === "BANKED"),
      (grant) => grant.durationDays,
    );
    if (endsAt === null) {
      return { source: null, endsAt: null, willRenew: false, bankedDays };
    }
    return {
      source: storeEndsAt.length > 0 ? "STORE" : "GRANT",
      endsAt: new Date(endsAt),
      willRenew: entitlements.storeSubscriptions.some((subscription) =>
        isStoreSubscriptionRenewing(subscription, now),
      ),
      bankedDays,
    };
  },

  /** 스토어 구독이 유효한 동안의 보상은 쌓아 두고, 끝나면 이어서 시작한다. */
  planNewGrantStart(entitlements: PremiumEntitlements, now: Date): PremiumGrantStart {
    if (hasStoreEntitlement(entitlements, now)) {
      return { kind: "bank" };
    }
    return {
      kind: "activate",
      startsAt: nextPremiumGrantStartsAt(entitlements.premiumGrants, now),
    };
  },

  /** 끝난 기간을 닫고, 스토어가 끝났으면 쌓아 둔 기간을 받은 순서대로 이어 붙인다. */
  planReconciliation(entitlements: PremiumEntitlements, now: Date): PremiumGrantReconciliation {
    const endedGrantIds = entitlements.premiumGrants
      .filter((grant) => isPremiumGrantEnded(grant, now))
      .map((grant) => grant.id);
    if (hasStoreEntitlement(entitlements, now)) {
      return { activations: [], endedGrantIds };
    }

    const chain: PremiumGrantTerm[] = entitlements.premiumGrants.filter((grant) =>
      isPremiumGrantActive(grant, now),
    );
    const activations: { grantId: string; startsAt: Date }[] = [];
    for (const banked of sortBy(
      entitlements.premiumGrants.filter((grant) => grant.status === "BANKED"),
      [(grant) => grant.createdAt.getTime(), (grant) => grant.id],
    )) {
      const startsAt = nextPremiumGrantStartsAt(chain, now);
      activations.push({ grantId: banked.id, startsAt });
      chain.push({
        ...banked,
        status: "ACTIVE",
        endsAt: premiumGrantEndsAt(startsAt, banked.durationDays),
      });
    }
    return { activations, endedGrantIds };
  },
};
