import {
  DomainEventPublisherPort,
  type PublishedDomainEvent,
} from "#api/shared/application/ports/index";
import type { DomainEvent } from "#api/shared/domain/model/domain-event";

export class RecordingDomainEventPublisher extends DomainEventPublisherPort {
  readonly events: DomainEvent[] = [];
  readonly publishedEvents: PublishedDomainEvent[] = [];
  async publishAll(events: readonly DomainEvent[]): Promise<void> {
    this.events.push(...events);
  }
  async publish(events: readonly PublishedDomainEvent[]): Promise<void> {
    this.publishedEvents.push(...events);
  }
}
