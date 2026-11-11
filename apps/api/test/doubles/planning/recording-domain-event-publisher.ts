import {
  DomainEventPublisherPort,
  type PublishedDomainEvent,
} from "#api/shared/application/ports/domain-event-publisher.port";

export class RecordingDomainEventPublisher extends DomainEventPublisherPort {
  readonly publishedEvents: PublishedDomainEvent[] = [];
  async publish(events: readonly PublishedDomainEvent[]): Promise<void> {
    this.publishedEvents.push(...events);
  }
}
