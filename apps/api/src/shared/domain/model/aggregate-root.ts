import type { DomainEvent } from "./domain-event.js";
import { Entity, type EntityIdentity } from "./entity.js";

export abstract class AggregateRoot<
  TId extends EntityIdentity,
  TProps extends object,
  TEvent extends DomainEvent = DomainEvent,
> extends Entity<TId, TProps> {
  #domainEvents: TEvent[] = [];

  protected raise(event: TEvent): void {
    this.#domainEvents.push(event);
  }

  pullDomainEvents(): TEvent[] {
    const events = this.#domainEvents;
    this.#domainEvents = [];
    return events;
  }
}
