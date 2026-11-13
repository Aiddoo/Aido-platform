import {
  STORE_PERIOD_TYPE,
  type StorePeriodType,
  type SubscriptionEnvironment,
  type SubscriptionPlanType,
  type SubscriptionStatus,
} from "@aido/api/vocabulary";

import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { AggregateRoot } from "#api/shared/domain/model/aggregate-root";

import { storeEntitlementEndsAt } from "../../shared/domain/store-renewal-grace.domain-service.js";
import { planTypeOfProduct } from "../../shared/domain/subscription-plan.domain-service.js";
import { StoreSubscriptionId } from "./store-subscription-id.vo.js";
import { SubscriptionId } from "./subscription-id.vo.js";

type Instant = Temporal.Instant;

export interface SubscriptionPrimitives {
  readonly id: number;
  readonly userId: string;
  readonly storeSubscriptionId: string;
  readonly productId: string;
  readonly status: SubscriptionStatus;
  readonly startedAt: Instant;
  readonly expiresAt: Instant;
  /** 스토어 결제 유예(billing grace)의 끝. 그때까지 갱신되지 않아도 엔타이틀먼트가 남는다. */
  readonly gracePeriodEndsAt: Instant | null;
  readonly cancelledAt: Instant | null;
  readonly lastProcessedEventId: string | null;
  /** PRODUCT_CHANGE_SCHEDULED가 남긴 다음 갱신의 상품. 실제 결제·재개 이벤트가 productId로 옮기고 비운다. */
  readonly nextProductId: string | null;
  /** 지금 기간의 스토어 기간 유형. null은 이 값을 저장하기 전에 만든 행(NORMAL)이다. */
  readonly periodType: StorePeriodType | null;
  /** 구매 웹훅의 결제 환경. 이 값을 저장하기 전에 만든 행은 null(알 수 없음)이다. */
  readonly environment: SubscriptionEnvironment | null;
  readonly updatedAt: Instant;
}

interface SubscriptionProps {
  userId: UserId;
  readonly storeSubscriptionId: StoreSubscriptionId;
  productId: string;
  status: SubscriptionStatus;
  readonly startedAt: Instant;
  expiresAt: Instant;
  gracePeriodEndsAt: Instant | null;
  cancelledAt: Instant | null;
  lastProcessedEventId: string | null;
  nextProductId: string | null;
  periodType: StorePeriodType | null;
  readonly environment: SubscriptionEnvironment | null;
  updatedAt: Instant;
}

interface CreateSubscriptionParams {
  readonly id: SubscriptionId;
  readonly userId: UserId;
  readonly storeSubscriptionId: StoreSubscriptionId;
  readonly productId: string;
  readonly startedAt: Instant;
  readonly expiresAt: Instant;
  readonly lastProcessedEventId?: string | null;
  readonly environment?: SubscriptionEnvironment | null;
  readonly periodType?: StorePeriodType | null;
  readonly now: Instant;
}

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

export class Subscription extends AggregateRoot<SubscriptionId, SubscriptionProps> {
  static create(params: CreateSubscriptionParams): Subscription {
    return new Subscription(params.id, {
      userId: params.userId,
      storeSubscriptionId: params.storeSubscriptionId,
      productId: params.productId,
      status: "ACTIVE",
      startedAt: params.startedAt,
      expiresAt: params.expiresAt,
      gracePeriodEndsAt: null,
      cancelledAt: null,
      lastProcessedEventId: params.lastProcessedEventId ?? null,
      nextProductId: null,
      periodType: params.periodType ?? null,
      environment: params.environment ?? null,
      updatedAt: params.now,
    });
  }

  static reconstitute(primitives: SubscriptionPrimitives): Subscription {
    return new Subscription(SubscriptionId.reconstitute(primitives.id), {
      userId: UserId.reconstitute(primitives.userId),
      storeSubscriptionId: StoreSubscriptionId.reconstitute(primitives.storeSubscriptionId),
      productId: primitives.productId,
      status: primitives.status,
      startedAt: primitives.startedAt,
      expiresAt: primitives.expiresAt,
      gracePeriodEndsAt: primitives.gracePeriodEndsAt,
      cancelledAt: primitives.cancelledAt,
      lastProcessedEventId: primitives.lastProcessedEventId,
      nextProductId: primitives.nextProductId,
      periodType: primitives.periodType,
      environment: primitives.environment,
      updatedAt: primitives.updatedAt,
    });
  }

  get userId(): UserId {
    return this.props.userId;
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

  get expiresAt(): Instant {
    return this.props.expiresAt;
  }

  get gracePeriodEndsAt(): Instant | null {
    return this.props.gracePeriodEndsAt;
  }

  get periodType(): StorePeriodType | null {
    return this.props.periodType;
  }

  /** 지금 기간의 요금제. 모르는 상품이면 null이다. */
  planType(): SubscriptionPlanType | null {
    return planTypeOfProduct(this.props.productId);
  }

  /** 다음 갱신에 결제될 요금제. 예약한 상품 변경이 있으면 그 상품이다. */
  renewingPlanType(): SubscriptionPlanType | null {
    return planTypeOfProduct(this.props.nextProductId ?? this.props.productId);
  }

  isTrial(): boolean {
    return this.props.periodType === STORE_PERIOD_TYPE.TRIAL;
  }

  isActive(): boolean {
    return this.props.status === "ACTIVE";
  }

  /** 배포 이전 행에 남은 마지막 이벤트 ID와 같으면 이미 반영한 이벤트다. */
  isAlreadyProcessed(eventId: string): boolean {
    return this.props.lastProcessedEventId === eventId;
  }

  /**
   * 체인의 이벤트가 다른 사용자로 오면 구매가 옮겨 간 것이다. 행의 소유자를 그 사용자로 바꿔 프리미엄 판단이
   * User projection 대신 행 자체를 믿게 한다. 이미 그 사용자 것이면 false다.
   */
  transferTo(userId: UserId, now: Instant): boolean {
    if (this.props.userId.equals(userId)) {
      return false;
    }
    this.props.userId = userId;
    this.props.updatedAt = now;
    return true;
  }

  /**
   * 새 기간으로 갱신한다. 같은 만료 시각의 재전송과 지난 기간의 늦은 갱신은 false다.
   * periodType을 비우면 지금 유형을 둔다(체험 전환 갱신은 NORMAL을 넘긴다).
   * App Store는 상품 변경을 갱신에 적용하므로 갱신의 상품을 저장한다.
   */
  renew(input: {
    readonly expiresAt: Instant;
    readonly now: Instant;
    readonly eventId?: string;
    readonly periodType?: StorePeriodType;
    readonly productId?: string;
  }): boolean {
    if (
      (this.isActive() && this.props.expiresAt.equals(input.expiresAt)) ||
      Temporal.Instant.compare(input.expiresAt, this.props.expiresAt) < 0
    ) {
      return false;
    }
    if (input.periodType != null) {
      this.props.periodType = input.periodType;
    }
    this.#applyProduct(input.productId);
    this.props.status = "ACTIVE";
    this.props.expiresAt = input.expiresAt;
    this.props.gracePeriodEndsAt = null;
    this.props.cancelledAt = null;
    this.#markEventApplied(input.eventId, input.now);
    return true;
  }

  /**
   * 결제 실패 뒤 스토어 결제 유예의 끝을 기록한다. 유예가 없거나, 이미 만료한 구독이나 지난 기간의
   * 늦은 이벤트(이벤트의 만료 시각이 지금 기간보다 이름)는 무시하고 false다.
   */
  enterBillingGrace(input: {
    readonly gracePeriodEndsAt: Instant | null;
    readonly periodExpiresAt: Instant | null;
    readonly now: Instant;
    readonly eventId?: string;
  }): boolean {
    if (
      input.gracePeriodEndsAt == null ||
      (this.props.status !== "ACTIVE" && this.props.status !== "CANCELLED")
    ) {
      return false;
    }
    if (this.#isPreviousPeriod(input.periodExpiresAt)) {
      return false;
    }
    this.props.gracePeriodEndsAt = input.gracePeriodEndsAt;
    this.#markEventApplied(input.eventId, input.now);
    return true;
  }

  /**
   * 해지·환불을 기록한다. 이미 결제로 넘어간 체인에 늦게 온 체험 기간의 해지(이벤트 기간 유형이 TRIAL인데
   * 행은 더 이상 체험이 아님)나 갱신 뒤 늦게 온 지난 기간의 해지는 갱신된 상태를 되돌리지 않고 false다.
   * 환불은 기간과 관계없이 끝낸다.
   */
  cancel(input: {
    readonly refunded: boolean;
    readonly now: Instant;
    readonly eventId?: string;
    readonly eventPeriodType?: StorePeriodType | null;
    readonly eventExpiresAt?: Instant | null;
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
    this.props.cancelledAt = input.now;
    this.#markEventApplied(input.eventId, input.now);
    return true;
  }

  /** 갱신 뒤 늦게 온 지난 기간의 해지 철회는 갱신된 기간을 앞당기지 않고 false다. */
  uncancel(input: {
    readonly expiresAt?: Instant;
    readonly now: Instant;
    readonly eventId?: string;
  }): boolean {
    if (this.#isPreviousPeriod(input.expiresAt)) {
      return false;
    }
    this.props.status = "ACTIVE";
    this.props.cancelledAt = null;
    this.#changeExpiry(input.expiresAt);
    this.#markEventApplied(input.eventId, input.now);
    return true;
  }

  /**
   * 결제 유예 중에 만료하면 스토어가 그 유예 동안 엔타이틀먼트를 준 것이므로, 유예를 지우고 만료 시각을
   * 유예가 실제로 끝난 시각(유예 끝과 만료 처리 시각 중 이른 쪽)까지 늘린다. 쌓아 둔 보상은 그 시각부터
   * 이어진다. 만료 시각이 지금 기간보다 이른 지난 기간의 만료는 false다.
   */
  expire(input: {
    readonly expirationAt: Instant | null;
    readonly now: Instant;
    readonly eventId?: string;
  }): boolean {
    if (this.#isPreviousPeriod(input.expirationAt)) {
      return false;
    }
    const graceEndsAt = this.props.gracePeriodEndsAt;
    if (graceEndsAt != null) {
      const graceEndedAt =
        Temporal.Instant.compare(graceEndsAt, input.now) <= 0 ? graceEndsAt : input.now;
      if (Temporal.Instant.compare(graceEndedAt, this.props.expiresAt) > 0) {
        this.props.expiresAt = graceEndedAt;
      }
    }
    this.props.status = "EXPIRED";
    this.props.gracePeriodEndsAt = null;
    this.#markEventApplied(input.eventId, input.now);
    return true;
  }

  /**
   * 상품 변경 예약을 기록한다. 상품 변경은 정보성 안내라 지금 기간의 상품·만료·상태는 실제 결제 이벤트
   * (App Store는 RENEWED, Play는 새 체인의 STARTED)가 맞추므로, 이 이벤트의 상품이 바꾸기 전·후 어느 값이든
   * 결과가 같도록 바꾼 대상(newProductId)만 남긴다. 갱신 뒤 늦게 온 지난 기간의 안내는 false다.
   */
  reserveProductChange(input: {
    readonly newProductId?: string;
    readonly expiresAt?: Instant;
    readonly now: Instant;
    readonly eventId?: string;
  }): boolean {
    if (this.#isPreviousPeriod(input.expiresAt)) {
      return false;
    }
    this.props.nextProductId = input.newProductId ?? null;
    this.#markEventApplied(input.eventId, input.now);
    return true;
  }

  /** 갱신 뒤 늦게 온 지난 기간의 연장은 갱신된 기간을 앞당기지 않고 false다. */
  extend(input: {
    readonly expiresAt?: Instant;
    readonly now: Instant;
    readonly eventId?: string;
  }): boolean {
    if (this.#isPreviousPeriod(input.expiresAt)) {
      return false;
    }
    this.props.status = "ACTIVE";
    this.#changeExpiry(input.expiresAt);
    this.#markEventApplied(input.eventId, input.now);
    return true;
  }

  /**
   * 스토어가 알려 준 상태로 행을 맞추고 고친 칸을 돌려준다. 같으면 빈 배열이다. 스토어가 접근을 주지 않는데
   * 우리가 아직 엔타이틀먼트를 주는 행(놓친 환불·만료, Play 요금제 교체로 남은 옛 체인)은 지금 끝낸다.
   * 접근을 주면 만료·자동 갱신·체험·상품을 스토어 값으로 맞춘다(놓친 갱신, 늦게 온 지난 기간 이벤트).
   */
  reconcileWithStore(state: StoreSubscriptionState, at: Instant): SubscriptionReconcileField[] {
    const fields = state.givesAccess
      ? this.#reconcileGrantedAccess(state, at)
      : this.#reconcileRevokedAccess(at);
    if (fields.length > 0) {
      this.props.updatedAt = at;
    }
    return fields;
  }

  toPrimitives(): SubscriptionPrimitives {
    return {
      id: this.id.value,
      userId: this.props.userId.value,
      storeSubscriptionId: this.props.storeSubscriptionId.value,
      productId: this.props.productId,
      status: this.props.status,
      startedAt: this.props.startedAt,
      expiresAt: this.props.expiresAt,
      gracePeriodEndsAt: this.props.gracePeriodEndsAt,
      cancelledAt: this.props.cancelledAt,
      lastProcessedEventId: this.props.lastProcessedEventId,
      nextProductId: this.props.nextProductId,
      periodType: this.props.periodType,
      environment: this.props.environment,
      updatedAt: this.props.updatedAt,
    };
  }

  #reconcileRevokedAccess(at: Instant): SubscriptionReconcileField[] {
    const entitlementEndsAt = storeEntitlementEndsAt(this.props);
    if (entitlementEndsAt == null || Temporal.Instant.compare(entitlementEndsAt, at) <= 0) {
      return [];
    }
    const fields: SubscriptionReconcileField[] = ["status"];
    this.props.status = "EXPIRED";
    this.props.gracePeriodEndsAt = null;
    if (Temporal.Instant.compare(this.props.expiresAt, at) > 0) {
      this.props.expiresAt = at;
      fields.push("expiresAt");
    }
    return fields;
  }

  #reconcileGrantedAccess(
    state: StoreSubscriptionState,
    at: Instant,
  ): SubscriptionReconcileField[] {
    const fields: SubscriptionReconcileField[] = [];
    const status = state.willRenew ? "ACTIVE" : "CANCELLED";
    if (this.props.status !== status) {
      this.props.status = status;
      this.props.cancelledAt = state.willRenew ? null : (this.props.cancelledAt ?? at);
      fields.push("status");
    }
    if (state.periodEndsAt != null && !this.props.expiresAt.equals(state.periodEndsAt)) {
      this.props.expiresAt = state.periodEndsAt;
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
  #isPreviousPeriod(eventExpiresAt: Instant | null | undefined): boolean {
    return (
      eventExpiresAt != null && Temporal.Instant.compare(eventExpiresAt, this.props.expiresAt) < 0
    );
  }

  /** 결제 이벤트의 상품이 지금 기간의 상품이다. 예약해 둔 변경은 적용됐으므로 비운다. */
  #applyProduct(productId: string | undefined): void {
    if (productId == null || productId === "") {
      return;
    }
    this.props.productId = productId;
    this.props.nextProductId = null;
  }

  #changeExpiry(expiresAt: Instant | undefined): void {
    if (expiresAt != null) {
      this.props.expiresAt = expiresAt;
    }
  }

  #markEventApplied(eventId: string | undefined, now: Instant): void {
    if (eventId != null && eventId !== "") {
      this.props.lastProcessedEventId = eventId;
    }
    this.props.updatedAt = now;
  }
}
