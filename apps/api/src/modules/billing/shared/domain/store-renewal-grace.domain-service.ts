/**
 * 자동 갱신 중(ACTIVE)인 스토어 구독은 만료 시각이 지나도 이만큼은 유효하다고 본다.
 *
 * 갱신 결제나 만료는 갱신·만료 이벤트로만 알 수 있다. 지금 결제 공급자는 실패한 웹훅을
 * 5·10·20·40·80분 간격으로 다시 보내므로(합 약 2.6시간) 그 재시도가 끝날 때까지 기다린다.
 * Billing(보상 기간 시작 판단)과 Access(엔타이틀먼트 판단)가 같은 값을 써야 한쪽만 프리미엄이
 * 끝났다고 보는 구간이 생기지 않는다.
 */
export const STORE_RENEWAL_GRACE_MS = 3 * 60 * 60 * 1000;

/** 스토어 구독 행 중 엔타이틀먼트가 끝나는 시각 판단에 필요한 값 */
export interface StoreEntitlementWindow {
  readonly status: string;
  readonly expiresAt: Temporal.Instant;
  /**
   * 결제 실패 뒤 스토어가 결제를 다시 시도하며 엔타이틀먼트를 유지하는 결제 유예(billing grace)의 끝.
   * BILLING_ISSUE 웹훅의 grace_period_expiration_at_ms이고 RENEWAL·EXPIRATION이 지운다.
   */
  readonly gracePeriodEndsAt?: Temporal.Instant | null;
}

/** 자동 갱신 중인 스토어 구독이 아직 유효하다고 볼 수 있는 마지막 시각(이 시각 미만이면 유효) */
export function storeRenewalGraceEndsAt(expiresAt: Temporal.Instant): Temporal.Instant {
  return expiresAt.add({ milliseconds: STORE_RENEWAL_GRACE_MS });
}

/** 이 시각보다 늦게 끝나는 자동 갱신 구독은 아직 유효하다. SQL 조건의 기준값으로 쓴다. */
export function storeRenewalCutoff(now: Temporal.Instant): Temporal.Instant {
  return now.subtract({ milliseconds: STORE_RENEWAL_GRACE_MS });
}

/**
 * 스토어 구독의 엔타이틀먼트가 끝나는 시각(이 시각 미만이면 유효). 엔타이틀먼트가 없는 상태면 null이다.
 * 자동 갱신 중이면 갱신 웹훅을 기다리는 유예까지, 취소했으면 만료 시각까지이고, 결제 유예 중이면
 * 그 끝까지 늘어난다(결제가 실패하면 공급자는 결제 문제와 해지를 함께 알린다).
 * Billing·Access의 TS 판단과 SQL 조건이 모두 이 규칙을 따른다.
 */
export function storeEntitlementEndsAt(store: StoreEntitlementWindow): Temporal.Instant | null {
  const baseEndsAt = baseEntitlementEndsAt(store);
  if (baseEndsAt == null) {
    return null;
  }
  const graceEndsAt = store.gracePeriodEndsAt;
  return graceEndsAt != null && Temporal.Instant.compare(graceEndsAt, baseEndsAt) > 0
    ? graceEndsAt
    : baseEndsAt;
}

function baseEntitlementEndsAt(store: StoreEntitlementWindow): Temporal.Instant | null {
  if (store.status === "ACTIVE") {
    return storeRenewalGraceEndsAt(store.expiresAt);
  }
  return store.status === "CANCELLED" ? store.expiresAt : null;
}

/**
 * 스토어가 알려 준 지금 기간의 끝. 결제 유예 중이면 유예의 끝이다(그때까지 갱신되지 않으면 끝난다).
 * 자동 갱신의 웹훅 대기 유예는 포함하지 않는다.
 */
export function storePeriodEndsAt(store: StoreEntitlementWindow): Temporal.Instant {
  const graceEndsAt = store.gracePeriodEndsAt;
  return graceEndsAt != null && Temporal.Instant.compare(graceEndsAt, store.expiresAt) > 0
    ? graceEndsAt
    : store.expiresAt;
}
