import { Global, Module } from "@nestjs/common";
import { DOMAIN_EVENT_PUBLISHER } from "@/shared/application/ports";
import { EventEmitterDomainEventPublisher } from "./event-emitter-domain-event.publisher";

/**
 * 도메인 이벤트 발행 모듈 (@Global)
 *
 * DOMAIN_EVENT_PUBLISHER 포트를 전역 제공합니다. 구독(@OnEvent)은 각
 * 기능 모듈의 application/events/ 핸들러가 담당합니다.
 * EventEmitterModule.forRoot()는 app.module에서 1회 배선됩니다.
 */
@Global()
@Module({
	providers: [
		{
			provide: DOMAIN_EVENT_PUBLISHER,
			useClass: EventEmitterDomainEventPublisher,
		},
	],
	exports: [DOMAIN_EVENT_PUBLISHER],
})
export class DomainEventsModule {}
