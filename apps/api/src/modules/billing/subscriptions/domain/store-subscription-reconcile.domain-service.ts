import { type StorePeriodType, type SubscriptionStatus } from "@aido/api/vocabulary";

import { STORE_PERIOD_TYPE } from "../../shared/domain/store-period-type.domain-service.js";
import { storeEntitlementEndsAt } from "../../shared/domain/store-renewal-grace.domain-service.js";

type Instant = Temporal.Instant;

/** 스토어가 지금 알려 주는 한 체인의 상태. 웹훅이 늦거나 빠져도 이 값이 진실이다. */
export interface StoreSubscriptionState {
  /** 우리 체인 키(Subscription.storeSubscriptionId)로 찾은 체인 */
  readonly storeSubscriptionId: string;
  /** 지금 기간의 스토어 상품 ID. 스토어가 알려 주지 않으면 null이다. */
  readonly productId: string | null;
  /** 지금 기간의 끝. 무기한 일시정지면 null이다. */
  readonly periodEndsAt: Instant | null;
  readonly willRenew: boolean;
  readonly isTrial: boolean;
  /** 스토어 기준으로 지금 엔타이틀먼트를 줘야 하는지 */
  readonly givesAccess: boolean;
}

/** 스토어 상태와 달라 고친 칸 */
const SUBSCRIPTION_RECONCILE_FIELDS = ["status", "expiresAt", "productId", "periodType"] as const;

export type SubscriptionReconcileField = (typeof SUBSCRIPTION_RECONCILE_FIELDS)[number];

/** 대조가 읽고 고치는 체인 행의 칸 */
export interface ReconcilableSubscriptionState {
  readonly status: SubscriptionStatus;
  readonly expiresAt: Instant;
  readonly gracePeriodEndsAt: Instant | null;
  readonly cancelledAt: Instant | null;
  readonly productId: string;
  readonly nextProductId: string | null;
  readonly periodType: StorePeriodType | null;
}

export interface StoreReconciliation {
  readonly state: ReconcilableSubscriptionState;
  /** 고친 칸. 같으면 빈 배열이다. */
  readonly fields: SubscriptionReconcileField[];
}

/**
 * 스토어가 알려 준 상태로 맞춘 행. 스토어가 접근을 주지 않는데 우리가 아직 엔타이틀먼트를 주는 행(놓친 환불·만료,
 * Play 요금제 교체로 남은 옛 체인)은 지금 끝낸다. 접근을 주면 만료·자동 갱신·체험·상품을 스토어 값으로 맞춘다
 * (놓친 갱신, 늦게 온 지난 기간 이벤트).
 */
export function reconcileWithStoreState(params: {
  readonly current: ReconcilableSubscriptionState;
  readonly store: StoreSubscriptionState;
  readonly at: Instant;
}): StoreReconciliation {
  return params.store.givesAccess
    ? reconcileGrantedAccess(params.current, params.store, params.at)
    : reconcileRevokedAccess(params.current, params.at);
}

function reconcileRevokedAccess(
  current: ReconcilableSubscriptionState,
  at: Instant,
): StoreReconciliation {
  const entitlementEndsAt = storeEntitlementEndsAt(current);
  if (entitlementEndsAt == null || Temporal.Instant.compare(entitlementEndsAt, at) <= 0) {
    return { state: current, fields: [] };
  }
  const isCutShort = Temporal.Instant.compare(current.expiresAt, at) > 0;
  return {
    state: {
      ...current,
      status: "EXPIRED",
      gracePeriodEndsAt: null,
      expiresAt: isCutShort ? at : current.expiresAt,
    },
    fields: isCutShort ? ["status", "expiresAt"] : ["status"],
  };
}

function reconcileGrantedAccess(
  current: ReconcilableSubscriptionState,
  store: StoreSubscriptionState,
  at: Instant,
): StoreReconciliation {
  const fields: SubscriptionReconcileField[] = [];
  let state = current;
  const status = store.willRenew ? "ACTIVE" : "CANCELLED";
  if (state.status !== status) {
    state = {
      ...state,
      status,
      cancelledAt: store.willRenew ? null : (state.cancelledAt ?? at),
    };
    fields.push("status");
  }
  if (store.periodEndsAt != null && !state.expiresAt.equals(store.periodEndsAt)) {
    state = { ...state, expiresAt: store.periodEndsAt };
    fields.push("expiresAt");
  }
  // 스토어의 상품이 지금 기간의 상품이다. 예약해 둔 변경은 적용됐으므로 비운다
  if (store.productId != null && store.productId !== state.productId) {
    if (store.productId !== "") {
      state = { ...state, productId: store.productId, nextProductId: null };
    }
    fields.push("productId");
  }
  const periodType = reconciledPeriodType(state.periodType, store.isTrial);
  if (periodType !== state.periodType) {
    state = { ...state, periodType };
    fields.push("periodType");
  }
  return { state, fields };
}

// 체험 여부만 스토어로 맞춘다. 도입가·프로모션 같은 다른 유형은 웹훅이 정한 그대로 둔다
function reconciledPeriodType(
  periodType: StorePeriodType | null,
  isTrial: boolean,
): StorePeriodType | null {
  if (isTrial) {
    return STORE_PERIOD_TYPE.TRIAL;
  }
  return periodType === STORE_PERIOD_TYPE.TRIAL ? STORE_PERIOD_TYPE.NORMAL : periodType;
}
