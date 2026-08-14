import { Injectable, Logger } from "@nestjs/common";
import { EventEmitter2 } from "@nestjs/event-emitter";

import type { DomainEventPublisherPort } from "@/shared/application/ports";
import type { DomainEvent } from "@/shared/domain/aggregate-root";

/**
 * EventEmitter2 기반 도메인 이벤트 퍼블리셔
 *
 * `emitAsync`를 await해 비동기 리스너 실패까지 관측합니다. 발행은 항상
 * 트랜잭션 커밋 이후이므로, 이벤트 단위로 실패를 기록하고 격리해 이미
 * 커밋된 요청을 500으로 뒤집지 않습니다.
 *
 * 이 경계는 관측성을 제공할 뿐 durable retry/outbox를 보장하지 않습니다.
 * 재시도가 필수인 부수효과는 별도의 내구성 큐/아웃박스가 필요합니다.
 */
@Injectable()
export class EventEmitterDomainEventPublisher implements DomainEventPublisherPort {
	readonly #logger = new Logger(EventEmitterDomainEventPublisher.name);

	constructor(private readonly eventEmitter: EventEmitter2) {}

	async publishAll(events: readonly DomainEvent[]): Promise<void> {
		for (const event of events) {
			try {
				await this.eventEmitter.emitAsync(event.eventName, event);
			} catch (error) {
				this.#logger.error(
					`Failed to publish domain event ${event.eventName}: ${error}`,
					error instanceof Error ? error.stack : undefined,
				);
			}
		}
	}
}
