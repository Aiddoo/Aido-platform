import { Global, Module } from "@nestjs/common";

import {
  DOMAIN_EVENT_PUBLISHER,
  DomainEventPublisherPort,
} from "#api/shared/application/ports/index";

import { EventEmitterDomainEventPublisher } from "./event-emitter-domain-event.publisher.js";

// 구독(@OnEvent)은 각 기능 모듈 핸들러가 맡고 EventEmitterModule.forRoot()는 app.module에서 한 번 배선한다
@Global()
@Module({
  providers: [
    {
      provide: DOMAIN_EVENT_PUBLISHER,
      useClass: EventEmitterDomainEventPublisher,
    },
    // 옛 Symbol 토큰을 쓰는 Context가 모두 옮겨질 때까지 같은 인스턴스의 별칭이다
    { provide: DomainEventPublisherPort, useExisting: DOMAIN_EVENT_PUBLISHER },
  ],
  exports: [DOMAIN_EVENT_PUBLISHER, DomainEventPublisherPort],
})
export class DomainEventsModule {}
