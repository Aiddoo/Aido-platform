import {
  STORE_PERIOD_TYPE,
  type StorePeriodType,
  type SubscriptionStatus,
} from "@aido/api/vocabulary";

import { isSame } from "#api/shared/domain/date/utils/compare";
import { now } from "#api/shared/domain/date/utils/core";
import { AggregateRoot } from "#api/shared/domain/index";

export interface SubscriptionProps {
  id: number;
  userId: string;
  revenueCatId: string;
  productId: string;
  status: SubscriptionStatus;
  startedAt: Date;
  expiresAt: Date;
  /** 스토어 결제 유예(billing grace)의 끝. 그때까지 갱신되지 않아도 엔타이틀먼트가 남는다. */
  gracePeriodEndsAt: Date | null;
  cancelledAt: Date | null;
  lastProcessedEventId: string | null;
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
  | "periodType"
>;

function copyDate(value: Date | null): Date | null {
  return value == null ? null : new Date(value);
}

export class Subscription extends AggregateRoot<SubscriptionProps> {
  static reconstitute(props: SubscriptionProps): Subscription {
    return new Subscription({
      id: props.id,
      userId: props.userId,
      revenueCatId: props.revenueCatId,
      productId: props.productId,
      status: props.status,
      startedAt: new Date(props.startedAt),
      expiresAt: new Date(props.expiresAt),
      gracePeriodEndsAt: copyDate(props.gracePeriodEndsAt),
      cancelledAt: copyDate(props.cancelledAt),
      lastProcessedEventId: props.lastProcessedEventId,
      periodType: props.periodType,
    });
  }

  get id(): number {
    return this.props.id;
  }
  get userId(): string {
    return this.props.userId;
  }
  get revenueCatId(): string {
    return this.props.revenueCatId;
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
   * (체험 전환 갱신은 NORMAL을 넘긴다).
   */
  renew(expiresAt: Date, eventId?: string, periodType?: StorePeriodType): boolean {
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

  changeProduct(productId: string, expiresAt: Date | undefined, eventId?: string): void {
    this.props.productId = productId;
    this.#changeExpiry(expiresAt);
    this.#recordEvent(eventId);
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

  /** 이벤트의 만료 시각이 지금 기간보다 이르면 이미 지난 기간의 이벤트다. 만료 시각이 없으면 판단하지 않는다. */
  #isPreviousPeriod(eventExpiresAt: Date | null | undefined): boolean {
    return eventExpiresAt != null && eventExpiresAt.getTime() < this.props.expiresAt.getTime();
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
