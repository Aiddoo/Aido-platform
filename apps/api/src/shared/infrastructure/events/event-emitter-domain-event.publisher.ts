import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";
import type { DomainEventPublisherPort } from "@/shared/application/ports";
import type { DomainEvent } from "@/shared/domain/aggregate-root";

/**
 * EventEmitter2 기반 도메인 이벤트 퍼블리셔
 *
 * `emit`은 동기라 리스너 예외가 그대로 전파됩니다. 발행은 항상 트랜잭션
 * 커밋 이후이므로, 예외가 새면 이미 커밋된 요청이 500으로 뒤집힙니다.
 * 이를 이벤트 단위 try/catch로 차단합니다 — 한 이벤트의 실패가 나머지
 * 이벤트 발행도 막지 않습니다.
 */
@Injectable()
export class EventEmitterDomainEventPublisher
	implements DomainEventPublisherPort
{
	readonly #logger = new Logger(EventEmitterDomainEventPublisher.name);

	constructor(private readonly eventEmitter: EventEmitter2) {}

	publishAll(events: readonly DomainEvent[]): void {
		for (const event of events) {
			try {
				this.eventEmitter.emit(event.eventName, event);
			} catch (error) {
				this.#logger.error(
					`Failed to publish domain event ${event.eventName}: ${error}`,
					error instanceof Error ? error.stack : undefined,
				);
			}
		}
	}
}
