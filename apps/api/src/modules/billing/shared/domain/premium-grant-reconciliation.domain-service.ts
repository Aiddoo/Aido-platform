import { maxBy } from "es-toolkit";

import {
  bankedInReceivedOrder,
  isPremiumGrantActive,
  isPremiumGrantEnded,
  isStoreEntitlementValid,
  type PremiumEntitlements,
  type PremiumGrantTerm,
  premiumGrantTermEndsAt,
  storeHandoffAt,
} from "./premium-access.domain-service.js";

type Instant = Temporal.Instant;

function isAfter(left: Instant, right: Instant): boolean {
  return Temporal.Instant.compare(left, right) > 0;
}

function isBefore(left: Instant, right: Instant): boolean {
  return Temporal.Instant.compare(left, right) < 0;
}

function latestOf(instants: readonly Instant[]): Instant | null {
  return maxBy(instants, (instant) => instant.epochMilliseconds) ?? null;
}

export type PremiumGrantStart =
  | { readonly kind: "bank" }
  | { readonly kind: "activate"; readonly startsAt: Instant };

export interface PremiumGrantReconciliation {
  /** 다시 쌓아 둘 기간. 스토어가 유효한데 아직 시작하지 않은 기간이다. */
  readonly rebankedGrantIds: readonly string[];
  /**
   * 스토어가 유효한데 이미 진행 중인 기간. 지금 끝내고 남은 일수(remainingPremiumGrantMs)를
   * 새 BANKED 기간으로 남겨 스토어가 끝난 뒤 이어서 쓴다.
   */
  readonly splitGrantIds: readonly string[];
  readonly activations: readonly { readonly grantId: string; readonly startsAt: Instant }[];
  /** 끝낼 기간. 시작과 동시에 이미 끝난 기간도 포함하므로 시작을 먼저 적용한다. */
  readonly endedGrantIds: readonly string[];
}

function hasNotStarted(grant: PremiumGrantTerm, now: Instant): boolean {
  return grant.status === "ACTIVE" && grant.startsAt != null && isAfter(grant.startsAt, now);
}

function isInProgress(grant: PremiumGrantTerm, now: Instant): boolean {
  return isPremiumGrantActive(grant, now) && !hasNotStarted(grant, now);
}

function hasStoreEntitlement(entitlements: PremiumEntitlements, now: Instant): boolean {
  return entitlements.storeSubscriptions.some((subscription) =>
    isStoreEntitlementValid(subscription, now),
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
  now: Instant,
): Instant {
  const handoffAt = latestOf([
    ...entitlements.premiumGrants.flatMap((grant) =>
      isPremiumGrantEnded(grant, now) && grant.endsAt != null ? [grant.endsAt] : [],
    ),
    ...entitlements.storeSubscriptions
      .map(storeHandoffAt)
      .filter((endsAt) => !isAfter(endsAt, now)),
  ]);
  const firstReceivedAt = banked[0]?.createdAt;
  if (handoffAt == null || firstReceivedAt == null || isBefore(handoffAt, firstReceivedAt)) {
    return now;
  }
  return handoffAt;
}

/**
 * 스토어 구독이나 진행 중인 기간이 있으면 쌓아 두고, 둘 다 없을 때만 바로 시작한다.
 * 미래에 시작하는 ACTIVE 기간을 만들지 않아 나중에 산 구독과 겹쳐 소진되지 않는다.
 */
export function planNewGrantStart(
  entitlements: PremiumEntitlements,
  now: Instant,
): PremiumGrantStart {
  if (
    hasStoreEntitlement(entitlements, now) ||
    entitlements.premiumGrants.some((grant) => isPremiumGrantActive(grant, now))
  ) {
    return { kind: "bank" };
  }
  return { kind: "activate", startsAt: now };
}

/**
 * 끝난 기간을 닫는다. 스토어가 유효하면 아직 시작하지 않은 기간을 다시 쌓아 두고, 진행 중인 기간은
 * 지금 끝내 남은 일수를 다시 쌓아 스토어 기간과 겹쳐 소진되지 않게 한다.
 * 스토어도 진행 중인 기간도 없으면 쌓아 둔 기간을 받은 순서대로 하나씩 시작한다.
 */
export function planPremiumReconciliation(
  entitlements: PremiumEntitlements,
  now: Instant,
): PremiumGrantReconciliation {
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
  const activations: { grantId: string; startsAt: Instant }[] = [];
  const endedAfterActivation: string[] = [];
  let startsAt = chainStartsAt(entitlements, banked, now);
  for (const grant of banked) {
    activations.push({ grantId: grant.id, startsAt });
    const endsAt = premiumGrantTermEndsAt(startsAt, grant);
    if (isAfter(endsAt, now)) {
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
}
