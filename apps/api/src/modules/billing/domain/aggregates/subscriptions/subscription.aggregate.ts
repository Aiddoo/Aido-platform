import {
  STORE_PERIOD_TYPE,
  type StorePeriodType,
  type SubscriptionPlanType,
  type SubscriptionStatus,
} from "@aido/api/vocabulary";

import { isSame } from "#api/shared/domain/date/utils/compare";
import { now } from "#api/shared/domain/date/utils/core";
import { AggregateRoot } from "#api/shared/domain/index";
import { storeEntitlementEndsAt } from "#api/shared/domain/store-renewal-grace";

import { SubscriptionPlanPolicy } from "../../policies/subscriptions/subscription-plan.policy.js";
import type { SubscriptionProvider } from "../../types/subscriptions/store-subscription.types.js";
import type { StoreSubscriptionId } from "../../value-objects/subscriptions/store-subscription-id.vo.js";

export interface SubscriptionProps {
  id: number;
  userId: string;
  /** 결제를 알려 주는 공급자. 지금은 하나라 저장하지 않고 복원할 때 정한다. */
  provider: SubscriptionProvider;
  storeSubscriptionId: StoreSubscriptionId;
  productId: string;
  status: SubscriptionStatus;
  startedAt: Date;
  expiresAt: Date;
  /** 스토어 결제 유예(billing grace)의 끝. 그때까지 갱신되지 않아도 엔타이틀먼트가 남는다. */
  gracePeriodEndsAt: Date | null;
  cancelledAt: Date | null;
  lastProcessedEventId: string | null;
  /** PRODUCT_CHANGE가 예약한 다음 갱신의 상품. 실제 결제·재개 이벤트가 productId로 옮기고 비운다. */
  nextProductId: string | null;
  /** 지금 기간의 스토어 기간 유형. null은 이 값을 저장하기 전에 만든 행(NORMAL)이다. */
  periodType: StorePeriodType | null;
}

export type SubscriptionPersistenceState = Pick<
  SubscriptionProps,
  | "productId"
  | "status"
  | "expiresAt"
  | "gracePeriodEndsAt"
  | "cancelledAt"
  | "lastProcessedEventId"
  | "nextProductId"
  | "periodType"
>;

/** 스토어가 지금 알려 주는 한 체인의 상태. 웹훅이 늦거나 빠져도 이 값이 진실이다. */
export interface StoreSubscriptionState {
  /** 우리 체인 키(Subscription.storeSubscriptionId)로 찾은 체인 */
  readonly storeSubscriptionId: string;
  /** 지금 기간의 스토어 상품 ID. 스토어가 알려 주지 않으면 null이다. */
  readonly productId: string | null;
  /** 지금 기간의 끝. 무기한 일시정지면 null이다. */
  readonly periodEndsAt: Date | null;
  readonly willRenew: boolean;
  readonly isTrial: boolean;
  /** 스토어 기준으로 지금 엔타이틀먼트를 줘야 하는지 */
  readonly givesAccess: boolean;
}

/** 스토어 상태와 달라 고친 칸 */
export type SubscriptionReconcileField = "status" | "expiresAt" | "productId" | "periodType";

function copyDate(value: Date | null): Date | null {
  return value == null ? null : new Date(value);
}

export class Subscription extends AggregateRoot<SubscriptionProps> {
  static reconstitute(props: SubscriptionProps): Subscription {
    return new Subscription({
      id: props.id,
      userId: props.userId,
      provider: props.provider,
      storeSubscriptionId: props.storeSubscriptionId,
      productId: props.productId,
      status: props.status,
      startedAt: new Date(props.startedAt),
      expiresAt: new Date(props.expiresAt),
      gracePeriodEndsAt: copyDate(props.gracePeriodEndsAt),
      cancelledAt: copyDate(props.cancelledAt),
      lastProcessedEventId: props.lastProcessedEventId,
      nextProductId: props.nextProductId,
      periodType: props.periodType,
    });
  }

  get id(): number {
    return this.props.id;
  }
  get userId(): string {
    return this.props.userId;
  }
  get provider(): SubscriptionProvider {
    return this.props.provider;
  }
  get storeSubscriptionId(): StoreSubscriptionId {
    return this.props.storeSubscriptionId;
  }
  get productId(): string {
    return this.props.productId;
  }
  get status(): SubscriptionStatus {
    return this.props.status;
  }
  get expiresAt(): Date {
    return new Date(this.props.expiresAt);
  }
  get gracePeriodEndsAt(): Date | null {
    return copyDate(this.props.gracePeriodEndsAt);
  }
  get cancelledAt(): Date | null {
    return copyDate(this.props.cancelledAt);
  }
  get lastProcessedEventId(): string | null {
    return this.props.lastProcessedEventId;
  }
  get periodType(): StorePeriodType | null {
    return this.props.periodType;
  }

  /** 지금 기간의 요금제. 모르는 상품이면 null이다. */
  planType(): SubscriptionPlanType | null {
    return SubscriptionPlanPolicy.planTypeOf(this.props.productId);
  }

  /** 다음 갱신에 결제될 요금제. 예약한 상품 변경이 있으면 그 상품이다. */
  renewingPlanType(): SubscriptionPlanType | null {
    return SubscriptionPlanPolicy.planTypeOf(this.props.nextProductId ?? this.props.productId);
  }

  isTrial(): boolean {
    return this.props.periodType === STORE_PERIOD_TYPE.TRIAL;
  }

  get persistenceState(): SubscriptionPersistenceState {
    return {
      productId: this.props.productId,
      status: this.props.status,
      expiresAt: new Date(this.props.expiresAt),
      gracePeriodEndsAt: copyDate(this.props.gracePeriodEndsAt),
      cancelledAt: copyDate(this.props.cancelledAt),
      lastProcessedEventId: this.props.lastProcessedEventId,
      nextProductId: this.props.nextProductId,
      periodType: this.props.periodType,
    };
  }

  isActive(): boolean {
    return this.props.status === "ACTIVE";
  }

  isActiveWithSameExpiry(expiresAt: Date): boolean {
    return this.isActive() && isSame(this.props.expiresAt, expiresAt);
  }

  wasProcessedWith(eventId: string): boolean {
    return this.props.lastProcessedEventId === eventId;
  }

  /**
   * 새 기간으로 갱신한다. 같은 만료 시각의 재전송은 false다. periodType을 비우면 지금 유형을 둔다
   * (체험 전환 갱신은 NORMAL을 넘긴다). App Store는 상품 변경을 갱신에 적용하므로 갱신의 상품을 저장한다.
   */
  renew(
    expiresAt: Date,
    eventId?: string,
    periodType?: StorePeriodType,
    productId?: string,
  ): boolean {
    // 같은 만료의 재전송과 지난 기간의 늦은 갱신은 이미 반영한 기간을 되돌리지 않는다
    if (
      this.isActiveWithSameExpiry(expiresAt) ||
      expiresAt.getTime() < this.props.expiresAt.getTime()
    ) {
      return false;
    }
    if (periodType != null) {
      this.props.periodType = periodType;
    }
    this.#applyProduct(productId);
    this.props.status = "ACTIVE";
    this.props.expiresAt = new Date(expiresAt);
    this.props.gracePeriodEndsAt = null;
    this.props.cancelledAt = null;
    this.#recordEvent(eventId);
    return true;
  }

  /**
   * 결제 실패 뒤 스토어 결제 유예의 끝을 기록한다. 유예가 없거나, 이미 만료한 구독이나 지난 기간의
   * 늦은 이벤트(이벤트의 만료 시각이 지금 기간보다 이름)는 무시하고 false다.
   */
  enterBillingGrace(input: {
    gracePeriodEndsAt: Date | null;
    periodExpiresAt: Date | null;
    eventId?: string;
  }): boolean {
    if (
      input.gracePeriodEndsAt == null ||
      (this.props.status !== "ACTIVE" && this.props.status !== "CANCELLED")
    ) {
      return false;
    }
    if (
      input.periodExpiresAt != null &&
      input.periodExpiresAt.getTime() < this.props.expiresAt.getTime()
    ) {
      return false;
    }
    this.props.gracePeriodEndsAt = new Date(input.gracePeriodEndsAt);
    this.#recordEvent(input.eventId);
    return true;
  }

  /**
   * 해지·환불을 기록한다. 이미 결제로 넘어간 체인에 늦게 온 체험 기간의 해지(이벤트 기간 유형이 TRIAL인데
   * 행은 더 이상 체험이 아님)나 갱신 뒤 늦게 온 지난 기간의 해지는 갱신된 상태를 되돌리지 않고 false다.
   * 환불은 기간과 관계없이 끝낸다.
   */
  cancel(input: {
    refunded: boolean;
    cancelledAt: Date;
    eventId?: string;
    eventPeriodType?: StorePeriodType | null;
    eventExpiresAt?: Date | null;
  }): boolean {
    if (
      !input.refunded &&
      ((input.eventPeriodType === STORE_PERIOD_TYPE.TRIAL &&
        this.props.periodType != null &&
        !this.isTrial()) ||
        this.#isPreviousPeriod(input.eventExpiresAt))
    ) {
      return false;
    }
    this.props.status = input.refunded ? "EXPIRED" : "CANCELLED";
    if (input.refunded) {
      this.props.gracePeriodEndsAt = null;
    }
    this.props.cancelledAt = new Date(input.cancelledAt);
    this.#recordEvent(input.eventId);
    return true;
  }

  /** 갱신 뒤 늦게 온 지난 기간의 해지 철회는 갱신된 기간을 앞당기지 않고 false다. */
  uncancel(expiresAt: Date | undefined, eventId?: string): boolean {
    if (this.#isPreviousPeriod(expiresAt)) {
      return false;
    }
    this.props.status = "ACTIVE";
    this.props.cancelledAt = null;
    this.#changeExpiry(expiresAt);
    this.#recordEvent(eventId);
    return true;
  }

  /**
   * 결제 유예 중에 만료하면 스토어가 그 유예 동안 엔타이틀먼트를 준 것이므로, 유예를 지우고 만료 시각을
   * 유예가 실제로 끝난 시각(유예 끝과 만료 처리 시각 중 이른 쪽)까지 늘린다. 쌓아 둔 보상은 그 시각부터
   * 이어진다.
   */
  expire(expirationAt: Date | null, eventId?: string, expiredAt: Date = now()): boolean {
    if (expirationAt != null && expirationAt.getTime() < this.props.expiresAt.getTime()) {
      return false;
    }
    const graceEndsAt = this.props.gracePeriodEndsAt;
    if (graceEndsAt != null) {
      const graceEndedAt = Math.min(graceEndsAt.getTime(), expiredAt.getTime());
      if (graceEndedAt > this.props.expiresAt.getTime()) {
        this.props.expiresAt = new Date(graceEndedAt);
      }
    }
    this.props.status = "EXPIRED";
    this.props.gracePeriodEndsAt = null;
    this.#recordEvent(eventId);
    return true;
  }

  /**
   * 상품 변경 예약을 기록한다. 상품 변경은 정보성 안내라 지금 기간의 상품·만료·상태는 실제 결제 이벤트
   * (Apple RENEWAL·Play INITIAL_PURCHASE)가 맞추므로, 이 이벤트의 product_id가 바꾸기 전·후 어느 값이든
   * 결과가 같도록 바꾼 대상(new_product_id)만 남긴다. 갱신 뒤 늦게 온 지난 기간의 안내는 false다.
   */
  reserveProductChange(input: {
    newProductId?: string;
    expiresAt?: Date;
    eventId?: string;
  }): boolean {
    if (this.#isPreviousPeriod(input.expiresAt)) {
      return false;
    }
    this.props.nextProductId = input.newProductId ?? null;
    this.#recordEvent(input.eventId);
    return true;
  }

  /** 갱신 뒤 늦게 온 지난 기간의 연장은 갱신된 기간을 앞당기지 않고 false다. */
  extend(expiresAt: Date | undefined, eventId?: string): boolean {
    if (this.#isPreviousPeriod(expiresAt)) {
      return false;
    }
    this.props.status = "ACTIVE";
    this.#changeExpiry(expiresAt);
    this.#recordEvent(eventId);
    return true;
  }

  /**
   * 스토어가 알려 준 상태로 행을 맞추고 고친 칸을 돌려준다. 같으면 빈 배열이다. 스토어가 접근을 주지 않는데
   * 우리가 아직 엔타이틀먼트를 주는 행(놓친 환불·만료, Play 요금제 교체로 남은 옛 체인)은 지금 끝낸다.
   * 접근을 주면 만료·자동 갱신·체험·상품을 스토어 값으로 맞춘다(놓친 갱신, 늦게 온 지난 기간 이벤트).
   */
  reconcileWithStore(state: StoreSubscriptionState, at: Date): SubscriptionReconcileField[] {
    if (!state.givesAccess) {
      const entitlementEndsAt = storeEntitlementEndsAt(this.props);
      if (entitlementEndsAt == null || entitlementEndsAt.getTime() <= at.getTime()) {
        return [];
      }
      const fields: SubscriptionReconcileField[] = ["status"];
      this.props.status = "EXPIRED";
      this.props.gracePeriodEndsAt = null;
      if (this.props.expiresAt.getTime() > at.getTime()) {
        this.props.expiresAt = new Date(at);
        fields.push("expiresAt");
      }
      return fields;
    }

    const fields: SubscriptionReconcileField[] = [];
    const status = state.willRenew ? "ACTIVE" : "CANCELLED";
    if (this.props.status !== status) {
      this.props.status = status;
      this.props.cancelledAt = state.willRenew ? null : (this.props.cancelledAt ?? new Date(at));
      fields.push("status");
    }
    if (state.periodEndsAt != null && !isSame(this.props.expiresAt, state.periodEndsAt)) {
      this.props.expiresAt = new Date(state.periodEndsAt);
      fields.push("expiresAt");
    }
    if (state.productId != null && state.productId !== this.props.productId) {
      this.#applyProduct(state.productId);
      fields.push("productId");
    }
    const periodType = this.#reconciledPeriodType(state.isTrial);
    if (periodType !== this.props.periodType) {
      this.props.periodType = periodType;
      fields.push("periodType");
    }
    return fields;
  }

  // 체험 여부만 스토어로 맞춘다. 도입가·프로모션 같은 다른 유형은 웹훅이 정한 그대로 둔다
  #reconciledPeriodType(isTrial: boolean): StorePeriodType | null {
    if (isTrial) {
      return STORE_PERIOD_TYPE.TRIAL;
    }
    return this.isTrial() ? STORE_PERIOD_TYPE.NORMAL : this.props.periodType;
  }

  /** 이벤트의 만료 시각이 지금 기간보다 이르면 이미 지난 기간의 이벤트다. 만료 시각이 없으면 판단하지 않는다. */
  #isPreviousPeriod(eventExpiresAt: Date | null | undefined): boolean {
    return eventExpiresAt != null && eventExpiresAt.getTime() < this.props.expiresAt.getTime();
  }

  /** 결제 이벤트의 상품이 지금 기간의 상품이다. 예약해 둔 변경은 적용됐으므로 비운다. */
  #applyProduct(productId: string | undefined): void {
    if (productId == null || productId === "") {
      return;
    }
    this.props.productId = productId;
    this.props.nextProductId = null;
  }

  #changeExpiry(expiresAt: Date | undefined): void {
    if (expiresAt != null) {
      this.props.expiresAt = new Date(expiresAt);
    }
  }

  #recordEvent(eventId: string | undefined): void {
    if (eventId != null && eventId !== "") {
      this.props.lastProcessedEventId = eventId;
    }
  }
}
