import {
  PREMIUM_GRANT_ENDED_WINDOW_DAYS,
  PREMIUM_SOURCE,
  type PremiumSource,
  STORE_PERIOD_TYPE,
  type StorePeriodType,
  type SubscriptionPlanType,
  type SubscriptionStatus,
} from "@aido/api/vocabulary";
import { maxBy, sortBy, sumBy } from "es-toolkit";

import { addDays, addMilliseconds } from "#api/shared/domain/date/utils/arithmetic";
import { storeEntitlementEndsAt, storePeriodEndsAt } from "#api/shared/domain/store-renewal-grace";

import { SubscriptionPlanPolicy } from "./subscription-plan.policy.js";

export type PremiumGrantStatusValue = "BANKED" | "ACTIVE" | "ENDED" | "REVOKED";

/** 보상 기간 계산은 UTC 달력 기준이라 하루는 항상 24시간이다. */
const DAY_MS = 24 * 60 * 60 * 1_000;

/** 프리미엄이 아닌 사용자에게 보상 기간이 끝났다고 알려 줄 기간 */
const RECENT_GRANT_ENDED_WINDOW_MS = PREMIUM_GRANT_ENDED_WINDOW_DAYS * DAY_MS;

/** 스토어 구독 행 중 프리미엄 판단에 필요한 값 */
export interface StoreEntitlement {
  /** 저장한 스토어 상품 ID. Play 구독은 "상품:기본요금제"다. */
  readonly productId: string;
  /** 체인을 처음 산 시각. 요금제를 바꿔 새 체인이 생기면 새 체인이 더 늦다. */
  readonly startedAt: Date;
  readonly status: SubscriptionStatus;
  readonly expiresAt: Date;
  /** 스토어 결제 유예(billing grace)의 끝. 그때까지 갱신되지 않아도 엔타이틀먼트가 남는다. */
  readonly gracePeriodEndsAt?: Date | null;
  /** 지금 기간의 스토어 기간 유형. 비우거나 null이면 NORMAL이다. */
  readonly periodType?: StorePeriodType | null;
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
  /** 진행 중에 끊고 남은 기간의 정확한 길이. 비우면 durationDays일이다. */
  readonly durationMs?: number | null;
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
  /** 지금 기간이 스토어 무료 체험인지. 체험은 새 출처가 아니라 STORE + periodType TRIAL이다. */
  readonly isTrial: boolean;
  /** 지금 기간을 정하는 스토어 구독의 요금제. STORE가 아니거나 모르는 상품이면 null이다. */
  readonly planType: SubscriptionPlanType | null;
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

/** 기간의 실제 길이(ms). 끊고 남은 기간은 일 단위로 올리지 않은 정확한 길이다. */
export function premiumGrantDurationMs(
  grant: Pick<PremiumGrantTerm, "durationDays" | "durationMs">,
): number {
  return grant.durationMs ?? grant.durationDays * DAY_MS;
}

/** 이 시각에 시작하면 끝나는 시각 */
export function premiumGrantTermEndsAt(
  startsAt: Date,
  grant: Pick<PremiumGrantTerm, "durationDays" | "durationMs">,
): Date {
  return grant.durationMs == null
    ? premiumGrantEndsAt(startsAt, grant.durationDays)
    : addMilliseconds(grant.durationMs, startsAt);
}

/** 기간 길이(ms)를 표시용 일수로 바꾼다. 남은 1ms도 1일로 보여 사용자가 기간을 잃었다고 보지 않게 한다. */
export function premiumGrantDaysOf(durationMs: number): number {
  return Math.ceil(durationMs / DAY_MS);
}

/**
 * 웹훅이 방금 판단한 체인 상태. 만료 시각·결제 유예를 비우면 행의 값을 쓰고, 만료 시각이 null이면
 * 엔타이틀먼트가 없다.
 */
export interface StoreEventChainState {
  readonly revenueCatId: string;
  readonly status: SubscriptionStatus;
  readonly expiresAt?: Date | null;
  readonly gracePeriodEndsAt?: Date | null;
  readonly periodType?: StorePeriodType | null;
}

/**
 * TRANSFER·다른 사용자의 체인 이벤트로 옮겨 간 행은 소유자가 바뀌어 읽히지 않으므로 남은 행을 그대로 믿는다.
 * 이번 이벤트의 체인은 행 대신 이벤트가 정한 상태로 본다(일반 취소는 만료 시각까지·환불은 즉시 종료).
 */
export function applyStoreEventChain(
  subscriptions: readonly StoreSubscriptionEntitlement[],
  eventChain: StoreEventChainState | undefined,
): StoreSubscriptionEntitlement[] {
  return subscriptions.flatMap((subscription) => {
    if (subscription.revenueCatId !== eventChain?.revenueCatId) {
      return [subscription];
    }
    // nullish-strict: null은 엔타이틀먼트 없음, 생략(만료 시각 없는 UNCANCELLATION·PRODUCT_CHANGE·SUBSCRIPTION_EXTENDED)은 행의 만료 시각 유지
    if (eventChain.expiresAt === null) {
      return [];
    }
    // nullish-strict: 생략은 행의 결제 유예 유지, null은 유예 없음
    const gracePeriodEndsAt =
      eventChain.gracePeriodEndsAt === undefined
        ? (subscription.gracePeriodEndsAt ?? null)
        : eventChain.gracePeriodEndsAt;
    return [
      {
        revenueCatId: subscription.revenueCatId,
        productId: subscription.productId,
        startedAt: subscription.startedAt,
        status: eventChain.status,
        expiresAt: eventChain.expiresAt ?? subscription.expiresAt,
        gracePeriodEndsAt,
        periodType: eventChain.periodType ?? subscription.periodType ?? null,
      },
    ];
  });
}

/**
 * 취소했어도 만료 전이면 스토어 엔타이틀먼트가 남아 있다.
 * 자동 갱신 중인 구독은 갱신·만료 웹훅을 기다리도록 만료 뒤 유예 시간까지, 결제 유예 중이면 그 끝까지
 * 유효하다(storeEntitlementEndsAt). SQL 조건도 같은 규칙이다.
 */
export function isStoreEntitlementValid(subscription: StoreEntitlement, now: Date): boolean {
  const endsAt = storeEntitlementEndsAt(subscription);
  return endsAt != null && endsAt.getTime() > now.getTime();
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
 * 진행 중인 기간을 지금 끊으면 남는 정확한 길이(ms). 일수로 올리지 않아 같은 기간을 여러 번 끊어도
 * 기간이 늘거나 줄지 않는다. 표시 일수는 premiumGrantDaysOf로 한 번만 올린다.
 */
export function remainingPremiumGrantMs(grant: PremiumGrantTerm, now: Date): number {
  if (grant.endsAt == null || grant.endsAt.getTime() <= now.getTime()) {
    return 0;
  }
  return grant.endsAt.getTime() - now.getTime();
}

/**
 * 스토어 구독이 보상 기간에 자리를 넘기는 시각. 엔타이틀먼트가 끝나는 시각(웹훅 대기 유예·결제 유예
 * 포함)이고, 만료한 구독은 만료 시각이다.
 */
function storeHandoffAt(subscription: StoreEntitlement): Date {
  return storeEntitlementEndsAt(subscription) ?? new Date(subscription.expiresAt);
}

/**
 * 지금 결제를 정하는 체인. Play는 요금제를 바꾸면 새 체인을 만들고 옛 체인이 원래 만료까지 ACTIVE로 남으므로
 * 유효한 체인 중 가장 늦게 시작한 체인이다(같으면 늦게 끝나는 쪽). /me 표시와 갱신 안내가 이 규칙 하나를 쓴다.
 */
export function currentStoreChainOf<TSubscription extends StoreEntitlement>(
  subscriptions: readonly TSubscription[],
  now: Date,
): TSubscription | undefined {
  return sortBy(
    subscriptions.filter((subscription) => isStoreEntitlementValid(subscription, now)),
    [
      (subscription) => subscription.startedAt.getTime(),
      (subscription) => storePeriodEndsAt(subscription).getTime(),
    ],
  ).at(-1);
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
    (endsAt, grant) => premiumGrantTermEndsAt(endsAt, grant),
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
    handoffAt == null ||
    firstReceivedAt == null ||
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
  if (endedAt == null || endedAt.getTime() + RECENT_GRANT_ENDED_WINDOW_MS <= now.getTime()) {
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
    const bankedDays = premiumGrantDaysOf(sumBy(banked, premiumGrantDurationMs));

    const currentStore = currentStoreChainOf(validStores, now);
    if (currentStore != null) {
      const activeGrantEnds = activeGrantEndsAt == null ? [] : [activeGrantEndsAt];
      // 지금 기간·갱신·요금제는 현재 체인으로 보여 주고, 프리미엄 끝과 보상 이어 붙이기는 아직 유효한 모든
      // 체인의 끝까지 본다(결제한 기간을 앞당겨 빼앗지 않는다). 겹쳐 시작한 보상 기간이 남으면 그 끝까지다
      const periodEndsAt = latestOf([storePeriodEndsAt(currentStore), ...activeGrantEnds]);
      const premiumEndsAt = latestOf([...validStores.map(storePeriodEndsAt), ...activeGrantEnds]);
      const handoffAt = latestOf([...validStores.map(storeHandoffAt), ...activeGrantEnds]);
      return {
        source: PREMIUM_SOURCE.STORE,
        endsAt:
          banked.length === 0 || handoffAt == null ? premiumEndsAt : chainBanked(handoffAt, banked),
        periodEndsAt,
        willRenew: isStoreSubscriptionRenewing(currentStore, now),
        isTrial: currentStore.periodType === STORE_PERIOD_TYPE.TRIAL,
        planType: SubscriptionPlanPolicy.planTypeOf(currentStore.productId),
        bankedDays,
        recentGrantEndedAt: null,
      };
    }
    if (activeGrantEndsAt == null) {
      // 스토어가 막 끝나 아직 시작하지 않은 기간은 다음 정리가 시작한다
      return {
        source: null,
        endsAt: null,
        periodEndsAt: null,
        willRenew: false,
        isTrial: false,
        planType: null,
        bankedDays,
        recentGrantEndedAt: recentGrantEndedAt(entitlements, now),
      };
    }
    return {
      source: PREMIUM_SOURCE.GRANT,
      endsAt: chainBanked(activeGrantEndsAt, banked),
      periodEndsAt: activeGrantEndsAt,
      willRenew: false,
      isTrial: false,
      planType: null,
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
      const endsAt = premiumGrantTermEndsAt(startsAt, grant);
      if (endsAt.getTime() > now.getTime()) {
        break;
      }
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
