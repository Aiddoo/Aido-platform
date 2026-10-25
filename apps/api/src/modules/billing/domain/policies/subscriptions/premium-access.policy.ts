import type { PremiumSource } from "@aido/api/vocabulary";
import { maxBy, sortBy, sumBy } from "es-toolkit";
import { match } from "ts-pattern";

import { addDays, addMilliseconds } from "#api/shared/domain/date/utils/arithmetic";
import { storeRenewalGraceEndsAt } from "#api/shared/domain/store-renewal-grace";

import type { SubscriptionStatusValue } from "../../aggregates/subscriptions/subscription.aggregate.js";

export type PremiumGrantStatusValue = "BANKED" | "ACTIVE" | "ENDED" | "REVOKED";

/** 보상 기간이 끝나기 이만큼 전에 한 번 안내한다. */
const PREMIUM_GRANT_ENDING_NOTICE_MS = 24 * 60 * 60 * 1_000;

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
  readonly startsAt: Date | null;
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
  /** 다시 쌓아 둘 기간. 스토어가 유효한데 아직 시작하지 않은 기간이다. */
  readonly rebankedGrantIds: readonly string[];
  readonly activations: readonly { readonly grantId: string; readonly startsAt: Date }[];
  /** 끝낼 기간. 시작과 동시에 이미 끝난 기간도 포함하므로 시작을 먼저 적용한다. */
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
 * 다른 사용자에게 옮겨 간 행은 저장소가 이미 뺐으므로 남은 행을 그대로 믿는다.
 * 이번 이벤트의 체인은 행 대신 이벤트가 정한 상태로 본다(일반 취소의 grace·환불 즉시 종료).
 */
export function applyStoreEventChain(
  subscriptions: readonly StoreSubscriptionEntitlement[],
  eventChain: StoreEventChainState | undefined,
): StoreSubscriptionEntitlement[] {
  return subscriptions.flatMap((subscription) => {
    if (subscription.revenueCatId !== eventChain?.revenueCatId) return [subscription];
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

/**
 * 취소했어도 만료 전이면 스토어 엔타이틀먼트가 남아 있다.
 * 자동 갱신 중인 구독은 갱신·만료 웹훅을 기다리도록 만료 뒤 유예 시간까지 유효하다.
 */
export function isStoreEntitlementValid(subscription: StoreEntitlement, now: Date): boolean {
  return match(subscription.status)
    .with("ACTIVE", () => storeRenewalGraceEndsAt(subscription.expiresAt).getTime() > now.getTime())
    .with("CANCELLED", () => subscription.expiresAt.getTime() > now.getTime())
    .with("FREE", "EXPIRED", () => false)
    .exhaustive();
}

/** 다음 결제가 예정된 구독. 취소하면 CANCELLED로 바뀐다. */
export function isStoreSubscriptionRenewing(subscription: StoreEntitlement, now: Date): boolean {
  return subscription.status === "ACTIVE" && isStoreEntitlementValid(subscription, now);
}

/** 아직 끝나지 않은 ACTIVE 기간. 예전에 미래 시작으로 이어 붙인 기간도 포함한다. */
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

function hasNotStarted(grant: PremiumGrantTerm, now: Date): boolean {
  return (
    grant.status === "ACTIVE" && grant.startsAt != null && grant.startsAt.getTime() > now.getTime()
  );
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

function bankedInReceivedOrder(grants: readonly PremiumGrantTerm[]): PremiumGrantTerm[] {
  return sortBy(
    grants.filter((grant) => grant.status === "BANKED"),
    [(grant) => grant.createdAt.getTime(), (grant) => grant.id],
  );
}

function latestEndsAt(grants: readonly PremiumGrantTerm[]): Date | null {
  return (
    maxBy(
      grants.flatMap((grant) => (grant.endsAt == null ? [] : [grant.endsAt])),
      (date) => date.getTime(),
    ) ?? null
  );
}

/**
 * 쌓아 둔 기간을 이어서 시작할 시각.
 * 앞 기간이 끝난 시각부터 이어 붙여 sweep 지연만큼 기간을 잃지 않게 한다(그동안 User projection은
 * 이어 붙인 끝까지 프리미엄이다). 앞 기간이 끝난 뒤 스토어가 유효했으면 스토어가 끝난 시각부터 잇는다.
 */
function chainStartsAt(entitlements: PremiumEntitlements, now: Date): Date {
  const previousEndsAt = latestEndsAt(
    entitlements.premiumGrants.filter((grant) => isPremiumGrantEnded(grant, now)),
  );
  if (previousEndsAt === null) return new Date(now);
  const storeLapsedAt = maxBy(
    entitlements.storeSubscriptions
      .map((subscription) => subscription.expiresAt)
      .filter((expiresAt) => expiresAt.getTime() <= now.getTime()),
    (date) => date.getTime(),
  );
  return storeLapsedAt != null && storeLapsedAt.getTime() > previousEndsAt.getTime()
    ? new Date(storeLapsedAt)
    : new Date(previousEndsAt);
}

export const PremiumAccessPolicy = {
  /**
   * 프리미엄 = max(유효한 스토어 구독, 보상 기간).
   * 스토어가 유효하면 출처는 STORE이고 쌓아 둔 기간은 bankedDays로만 보인다.
   * 스토어가 없으면 진행 중인 기간 뒤에 쌓아 둔 기간을 받은 순서대로 이어 붙인 끝이 종료 시각이다.
   */
  resolve(entitlements: PremiumEntitlements, now: Date): PremiumAccess {
    const storeEndsAt = entitlements.storeSubscriptions
      .filter((subscription) => isStoreEntitlementValid(subscription, now))
      .map((subscription) => subscription.expiresAt);
    const activeGrantEndsAt = latestEndsAt(
      entitlements.premiumGrants.filter((grant) => isPremiumGrantActive(grant, now)),
    );
    const banked = bankedInReceivedOrder(entitlements.premiumGrants);
    const bankedDays = sumBy(banked, (grant) => grant.durationDays);

    const storeAndGrantEndsAt = maxBy(
      [...storeEndsAt, ...(activeGrantEndsAt === null ? [] : [activeGrantEndsAt])],
      (date) => date.getTime(),
    );
    if (storeEndsAt.length > 0 && storeAndGrantEndsAt != null) {
      return {
        source: "STORE",
        endsAt: new Date(storeAndGrantEndsAt),
        willRenew: entitlements.storeSubscriptions.some((subscription) =>
          isStoreSubscriptionRenewing(subscription, now),
        ),
        bankedDays,
      };
    }
    if (activeGrantEndsAt === null) {
      // 스토어가 막 끝나 아직 시작하지 않은 기간은 다음 정리가 시작한다
      return { source: null, endsAt: null, willRenew: false, bankedDays };
    }
    return {
      source: "GRANT",
      endsAt: banked.reduce(
        (endsAt, grant) => premiumGrantEndsAt(endsAt, grant.durationDays),
        new Date(activeGrantEndsAt),
      ),
      willRenew: false,
      bankedDays: 0,
    };
  },

  /**
   * 스토어 구독이나 진행 중인 기간이 있으면 쌓아 두고, 둘 다 없을 때만 바로 시작한다.
   * 미래에 시작하는 ACTIVE 기간을 만들지 않아 나중에 산 구독과 겹쳐 소진되지 않는다.
   */
  planNewGrantStart(entitlements: PremiumEntitlements, now: Date): PremiumGrantStart {
    if (
      hasStoreEntitlement(entitlements, now) ||
      entitlements.premiumGrants.some((grant) => isPremiumGrantActive(grant, now))
    ) {
      return { kind: "bank" };
    }
    return { kind: "activate", startsAt: new Date(now) };
  },

  /**
   * 끝난 기간을 닫는다. 스토어가 유효하면 아직 시작하지 않은 기간을 다시 쌓아 두고,
   * 스토어도 진행 중인 기간도 없으면 쌓아 둔 기간을 받은 순서대로 하나씩 시작한다.
   */
  planReconciliation(entitlements: PremiumEntitlements, now: Date): PremiumGrantReconciliation {
    const endedGrantIds = entitlements.premiumGrants
      .filter((grant) => isPremiumGrantEnded(grant, now))
      .map((grant) => grant.id);
    if (hasStoreEntitlement(entitlements, now)) {
      return {
        rebankedGrantIds: entitlements.premiumGrants
          .filter((grant) => hasNotStarted(grant, now))
          .map((grant) => grant.id),
        activations: [],
        endedGrantIds,
      };
    }
    if (entitlements.premiumGrants.some((grant) => isPremiumGrantActive(grant, now))) {
      return { rebankedGrantIds: [], activations: [], endedGrantIds };
    }

    // 정리가 오래 밀렸으면 그동안 끝났어야 할 기간도 이어 붙여 시작하고 바로 끝낸다
    const activations: { grantId: string; startsAt: Date }[] = [];
    const endedAfterActivation: string[] = [];
    let startsAt = chainStartsAt(entitlements, now);
    for (const banked of bankedInReceivedOrder(entitlements.premiumGrants)) {
      activations.push({ grantId: banked.id, startsAt });
      const endsAt = premiumGrantEndsAt(startsAt, banked.durationDays);
      if (endsAt.getTime() > now.getTime()) break;
      endedAfterActivation.push(banked.id);
      startsAt = endsAt;
    }
    return {
      rebankedGrantIds: [],
      activations,
      endedGrantIds: [...endedGrantIds, ...endedAfterActivation],
    };
  },
};
