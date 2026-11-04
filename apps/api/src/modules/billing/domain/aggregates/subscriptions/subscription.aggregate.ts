import type { SubscriptionStatus } from "@aido/api/vocabulary";

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
}

export type SubscriptionPersistenceState = Pick<
  SubscriptionProps,
  | "productId"
  | "status"
  | "expiresAt"
  | "gracePeriodEndsAt"
  | "cancelledAt"
  | "lastProcessedEventId"
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

  get persistenceState(): SubscriptionPersistenceState {
    return {
      productId: this.props.productId,
      status: this.props.status,
      expiresAt: new Date(this.props.expiresAt),
      gracePeriodEndsAt: copyDate(this.props.gracePeriodEndsAt),
      cancelledAt: copyDate(this.props.cancelledAt),
      lastProcessedEventId: this.props.lastProcessedEventId,
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

  renew(expiresAt: Date, eventId?: string): boolean {
    if (this.isActiveWithSameExpiry(expiresAt)) {
      return false;
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

  cancel(input: { refunded: boolean; cancelledAt: Date; eventId?: string }): void {
    this.props.status = input.refunded ? "EXPIRED" : "CANCELLED";
    if (input.refunded) {
      this.props.gracePeriodEndsAt = null;
    }
    this.props.cancelledAt = new Date(input.cancelledAt);
    this.#recordEvent(input.eventId);
  }

  uncancel(expiresAt: Date | undefined, eventId?: string): void {
    this.props.status = "ACTIVE";
    this.props.cancelledAt = null;
    this.#changeExpiry(expiresAt);
    this.#recordEvent(eventId);
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

  extend(expiresAt: Date | undefined, eventId?: string): void {
    this.props.status = "ACTIVE";
    this.#changeExpiry(expiresAt);
    this.#recordEvent(eventId);
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
