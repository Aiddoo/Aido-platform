import { Global, Module } from "@nestjs/common";
import { DiscoveryModule } from "@nestjs/core";

import {
  DOMAIN_EVENT_PUBLISHER,
  DomainEventPublisherPort,
} from "#api/shared/application/ports/index";

import { eventSubscriptionCatalogProvider } from "./event-subscription.catalog.js";
import { FanOutDomainEventPublisher } from "./fan-out-domain-event.publisher.js";

// 구독은 slice module이 provideEventSubscriptions로 선언하고, after-commit 전달 채널(EventEmitterModule.forRoot())은 app.module이 배선한다
@Global()
@Module({
  imports: [DiscoveryModule],
  providers: [
    eventSubscriptionCatalogProvider,
    FanOutDomainEventPublisher,
    { provide: DOMAIN_EVENT_PUBLISHER, useExisting: FanOutDomainEventPublisher },
    // 옛 Symbol 토큰을 쓰는 Context가 모두 옮겨질 때까지 같은 인스턴스의 별칭이다
    { provide: DomainEventPublisherPort, useExisting: DOMAIN_EVENT_PUBLISHER },
  ],
  exports: [DOMAIN_EVENT_PUBLISHER, DomainEventPublisherPort, FanOutDomainEventPublisher],
})
export class DomainEventsModule {}
