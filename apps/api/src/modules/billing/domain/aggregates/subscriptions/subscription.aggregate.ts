import { isSame } from "#api/shared/domain/date/utils/compare";
import { AggregateRoot } from "#api/shared/domain/index";

export type SubscriptionStatusValue = "FREE" | "ACTIVE" | "EXPIRED" | "CANCELLED";

export interface SubscriptionProps {
  id: number;
  userId: string;
  revenueCatId: string;
  productId: string;
  status: SubscriptionStatusValue;
  startedAt: Date;
  expiresAt: Date;
  cancelledAt: Date | null;
  lastProcessedEventId: string | null;
}

export type SubscriptionPersistenceState = Pick<
  SubscriptionProps,
  "productId" | "status" | "expiresAt" | "cancelledAt" | "lastProcessedEventId"
>;

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
      cancelledAt: props.cancelledAt === null ? null : new Date(props.cancelledAt),
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
  get status(): SubscriptionStatusValue {
    return this.props.status;
  }
  get expiresAt(): Date {
    return new Date(this.props.expiresAt);
  }
  get cancelledAt(): Date | null {
    return this.props.cancelledAt === null ? null : new Date(this.props.cancelledAt);
  }
  get lastProcessedEventId(): string | null {
    return this.props.lastProcessedEventId;
  }

  get persistenceState(): SubscriptionPersistenceState {
    return {
      productId: this.props.productId,
      status: this.props.status,
      expiresAt: new Date(this.props.expiresAt),
      cancelledAt: this.props.cancelledAt === null ? null : new Date(this.props.cancelledAt),
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
    if (this.isActiveWithSameExpiry(expiresAt)) return false;
    this.props.status = "ACTIVE";
    this.props.expiresAt = new Date(expiresAt);
    this.props.cancelledAt = null;
    this.#recordEvent(eventId);
    return true;
  }

  cancel(input: { refunded: boolean; cancelledAt: Date; eventId?: string }): void {
    this.props.status = input.refunded ? "EXPIRED" : "CANCELLED";
    this.props.cancelledAt = new Date(input.cancelledAt);
    this.#recordEvent(input.eventId);
  }

  uncancel(expiresAt: Date | undefined, eventId?: string): void {
    this.props.status = "ACTIVE";
    this.props.cancelledAt = null;
    this.#changeExpiry(expiresAt);
    this.#recordEvent(eventId);
  }

  expire(expirationAt: Date | null, eventId?: string): boolean {
    if (expirationAt !== null && expirationAt.getTime() < this.props.expiresAt.getTime())
      return false;
    this.props.status = "EXPIRED";
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
    if (expiresAt !== undefined) this.props.expiresAt = new Date(expiresAt);
  }

  #recordEvent(eventId: string | undefined): void {
    if (eventId !== undefined && eventId !== "") this.props.lastProcessedEventId = eventId;
  }
}
