import type { PremiumSource } from "@aido/api/vocabulary";
import { maxBy, sortBy, sumBy } from "es-toolkit";
import { match } from "ts-pattern";

import { addDays, addMilliseconds } from "#api/shared/domain/date/utils/arithmetic";
import { storeRenewalGraceEndsAt } from "#api/shared/domain/store-renewal-grace";

import type { SubscriptionStatusValue } from "../../aggregates/subscriptions/subscription.aggregate.js";

export type PremiumGrantStatusValue = "BANKED" | "ACTIVE" | "ENDED" | "REVOKED";

/** 보상 기간이 끝나기 이만큼 전에 한 번 안내한다. */
const PREMIUM_GRANT_ENDING_NOTICE_MS = 24 * 60 * 60 * 1_000;

/** 보상 기간 계산은 UTC 달력 기준이라 하루는 항상 24시간이다. */
const DAY_MS = 24 * 60 * 60 * 1_000;

/** 프리미엄이 아닌 사용자에게 보상 기간이 끝났다고 알려 줄 기간 */
const RECENT_GRANT_ENDED_WINDOW_MS = 7 * DAY_MS;

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
  /** 아직 끝나지 않은(BANKED·ACTIVE) 기간. 끝나는 시각이 지났지만 정리 전인 ACTIVE 기간도 들어 있다. */
  readonly premiumGrants: readonly PremiumGrantTerm[];
  /** 이미 ENDED로 정리한 기간 중 가장 늦게 끝난 시각. 조회 화면만 읽고 정리는 쓰지 않는다. */
  readonly lastEndedGrantAt?: Date | null;
}

export interface PremiumAccess {
  readonly source: PremiumSource | null;
  /** 프리미엄 전체가 끝나는 시각. 지금 출처 뒤에 쌓아 둔 기간을 이어 붙인 끝이다. */
  readonly endsAt: Date | null;
  /** 지금 출처의 기간이 끝나는 시각. STORE면 스토어 만료, GRANT면 진행 중인 보상 기간의 끝이다. */
  readonly periodEndsAt: Date | null;
  readonly willRenew: boolean;
  /** 지금 기간이 끝나면 이어서 시작할, 쌓아 둔 보상 일수 합계 */
  readonly bankedDays: number;
  /** 프리미엄이 아닐 때만, 최근 7일 안에 끝난 마지막 보상 기간의 끝 시각 */
  readonly recentGrantEndedAt: Date | null;
}

export type PremiumGrantStart =
  | { readonly kind: "bank" }
  | { readonly kind: "activate"; readonly startsAt: Date };

export interface PremiumGrantReconciliation {
  /** 다시 쌓아 둘 기간. 스토어가 유효한데 아직 시작하지 않은 기간이다. */
  readonly rebankedGrantIds: readonly string[];
  /**
   * 스토어가 유효한데 이미 진행 중인 기간. 지금 끝내고 남은 일수(remainingPremiumGrantDays)를
   * 새 BANKED 기간으로 남겨 스토어가 끝난 뒤 이어서 쓴다.
   */
  readonly splitGrantIds: readonly string[];
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
 * TRANSFER·다른 사용자의 체인 이벤트로 옮겨 간 행은 소유자가 바뀌어 읽히지 않으므로 남은 행을 그대로 믿는다.
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

function isInProgress(grant: PremiumGrantTerm, now: Date): boolean {
  return isPremiumGrantActive(grant, now) && !hasNotStarted(grant, now);
}

/**
 * 진행 중인 기간을 지금 끊으면 남는 일수. 일 단위로만 쌓아 둘 수 있어 남은 시간을 올림해
 * 사용자가 기간을 잃지 않게 한다(남은 1ms도 1일).
 */
export function remainingPremiumGrantDays(grant: PremiumGrantTerm, now: Date): number {
  if (grant.endsAt == null || grant.endsAt.getTime() <= now.getTime()) return 0;
  return Math.ceil((grant.endsAt.getTime() - now.getTime()) / DAY_MS);
}

/**
 * 스토어 구독이 보상 기간에 자리를 넘기는 시각. 자동 갱신 중이면 갱신 웹훅을 기다리는 유예까지,
 * 취소·만료했으면 만료 시각까지 스토어가 프리미엄을 맡는다.
 */
function storeHandoffAt(subscription: StoreEntitlement): Date {
  return subscription.status === "ACTIVE"
    ? storeRenewalGraceEndsAt(subscription.expiresAt)
    : new Date(subscription.expiresAt);
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

function latestOf(dates: readonly Date[]): Date | null {
  const latest = maxBy(dates, (date) => date.getTime());
  return latest == null ? null : new Date(latest);
}

function latestEndsAt(grants: readonly PremiumGrantTerm[]): Date | null {
  return latestOf(grants.flatMap((grant) => (grant.endsAt == null ? [] : [grant.endsAt])));
}

function chainBanked(startsAt: Date, banked: readonly PremiumGrantTerm[]): Date {
  return banked.reduce(
    (endsAt, grant) => premiumGrantEndsAt(endsAt, grant.durationDays),
    new Date(startsAt),
  );
}

/**
 * 쌓아 둔 기간을 이어서 시작할 시각.
 * 앞 기간이나 스토어가 끝난 시각 중 늦은 쪽부터 이어 붙여 정리 지연만큼 빈틈이나 기간 손실이 없게 한다
 * (그동안 User projection은 이어 붙인 끝까지 프리미엄이다). 쌓아 둔 기간을 받기 전에 끝난 스토어·기간은
 * 이어 붙일 대상이 아니므로 그때는 지금 시작해 지난 시각으로 기간을 소진하지 않는다.
 */
function chainStartsAt(
  entitlements: PremiumEntitlements,
  banked: readonly PremiumGrantTerm[],
  now: Date,
): Date {
  const handoffAt = latestOf([
    ...entitlements.premiumGrants.flatMap((grant) =>
      isPremiumGrantEnded(grant, now) && grant.endsAt != null ? [grant.endsAt] : [],
    ),
    ...entitlements.storeSubscriptions
      .map(storeHandoffAt)
      .filter((endsAt) => endsAt.getTime() <= now.getTime()),
  ]);
  const firstReceivedAt = banked[0]?.createdAt;
  if (
    handoffAt === null ||
    firstReceivedAt === undefined ||
    handoffAt.getTime() < firstReceivedAt.getTime()
  ) {
    return new Date(now);
  }
  return handoffAt;
}

/** 정리 전에 끝난 ACTIVE 기간과 이미 정리한 기간 중 마지막 끝이 최근 7일 안이면 그 시각 */
function recentGrantEndedAt(entitlements: PremiumEntitlements, now: Date): Date | null {
  const endedAt = latestOf([
    ...entitlements.premiumGrants.flatMap((grant) =>
      isPremiumGrantEnded(grant, now) && grant.endsAt != null ? [grant.endsAt] : [],
    ),
    ...(entitlements.lastEndedGrantAt == null ? [] : [entitlements.lastEndedGrantAt]),
  ]);
  if (endedAt === null || endedAt.getTime() + RECENT_GRANT_ENDED_WINDOW_MS <= now.getTime()) {
    return null;
  }
  return endedAt;
}

export const PremiumAccessPolicy = {
  /**
   * 프리미엄 = 유효한 스토어 구독 또는 진행 중인 보상 기간, 그 뒤에 쌓아 둔 기간.
   * 스토어가 유효하면 출처는 STORE이고, 지금 기간은 스토어 만료까지다. 쌓아 둔 기간은 스토어가
   * 자리를 넘기는 시각부터, 스토어가 없으면 진행 중인 기간 뒤부터 받은 순서대로 이어 붙인다.
   */
  resolve(entitlements: PremiumEntitlements, now: Date): PremiumAccess {
    const validStores = entitlements.storeSubscriptions.filter((subscription) =>
      isStoreEntitlementValid(subscription, now),
    );
    const activeGrantEndsAt = latestEndsAt(
      entitlements.premiumGrants.filter((grant) => isPremiumGrantActive(grant, now)),
    );
    const banked = bankedInReceivedOrder(entitlements.premiumGrants);
    const bankedDays = sumBy(banked, (grant) => grant.durationDays);

    const storeEndsAt = latestOf(validStores.map((subscription) => subscription.expiresAt));
    if (storeEndsAt !== null) {
      // 예전에 스토어와 겹쳐 시작한 기간이 남아 있으면 그 끝까지 프리미엄이다
      const periodEndsAt = latestOf([
        storeEndsAt,
        ...(activeGrantEndsAt === null ? [] : [activeGrantEndsAt]),
      ]);
      const handoffAt = latestOf([
        ...validStores.map(storeHandoffAt),
        ...(activeGrantEndsAt === null ? [] : [activeGrantEndsAt]),
      ]);
      return {
        source: "STORE",
        endsAt:
          banked.length === 0 || handoffAt === null ? periodEndsAt : chainBanked(handoffAt, banked),
        periodEndsAt,
        willRenew: validStores.some((subscription) =>
          isStoreSubscriptionRenewing(subscription, now),
        ),
        bankedDays,
        recentGrantEndedAt: null,
      };
    }
    if (activeGrantEndsAt === null) {
      // 스토어가 막 끝나 아직 시작하지 않은 기간은 다음 정리가 시작한다
      return {
        source: null,
        endsAt: null,
        periodEndsAt: null,
        willRenew: false,
        bankedDays,
        recentGrantEndedAt: recentGrantEndedAt(entitlements, now),
      };
    }
    return {
      source: "GRANT",
      endsAt: chainBanked(activeGrantEndsAt, banked),
      periodEndsAt: activeGrantEndsAt,
      willRenew: false,
      bankedDays,
      recentGrantEndedAt: null,
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
   * 끝난 기간을 닫는다. 스토어가 유효하면 아직 시작하지 않은 기간을 다시 쌓아 두고, 진행 중인 기간은
   * 지금 끝내 남은 일수를 다시 쌓아 스토어 기간과 겹쳐 소진되지 않게 한다.
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
        splitGrantIds: entitlements.premiumGrants
          .filter((grant) => isInProgress(grant, now))
          .map((grant) => grant.id),
        activations: [],
        endedGrantIds,
      };
    }
    if (entitlements.premiumGrants.some((grant) => isPremiumGrantActive(grant, now))) {
      return { rebankedGrantIds: [], splitGrantIds: [], activations: [], endedGrantIds };
    }

    // 정리가 오래 밀렸으면 그동안 끝났어야 할 기간도 이어 붙여 시작하고 바로 끝낸다
    const banked = bankedInReceivedOrder(entitlements.premiumGrants);
    const activations: { grantId: string; startsAt: Date }[] = [];
    const endedAfterActivation: string[] = [];
    let startsAt = chainStartsAt(entitlements, banked, now);
    for (const grant of banked) {
      activations.push({ grantId: grant.id, startsAt });
      const endsAt = premiumGrantEndsAt(startsAt, grant.durationDays);
      if (endsAt.getTime() > now.getTime()) break;
      endedAfterActivation.push(grant.id);
      startsAt = endsAt;
    }
    return {
      rebankedGrantIds: [],
      splitGrantIds: [],
      activations,
      endedGrantIds: [...endedGrantIds, ...endedAfterActivation],
    };
  },
};
