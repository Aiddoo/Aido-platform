import { Global, Module } from "@nestjs/common";
import { DiscoveryModule } from "@nestjs/core";

import { DomainEventPublisherPort } from "#api/shared/application/ports/domain-event-publisher.port";

import { eventSubscriptionCatalogProvider } from "./event-subscription.catalog.js";
import { FanOutDomainEventPublisher } from "./fan-out-domain-event.publisher.js";

// 구독은 slice module이 provideEventSubscriptions로 선언하고, after-commit 전달 채널(EventEmitterModule.forRoot())은 app.module이 배선한다
@Global()
@Module({
  imports: [DiscoveryModule],
  providers: [
    eventSubscriptionCatalogProvider,
    FanOutDomainEventPublisher,
    { provide: DomainEventPublisherPort, useExisting: FanOutDomainEventPublisher },
  ],
  exports: [DomainEventPublisherPort, FanOutDomainEventPublisher],
})
export class DomainEventsModule {}
