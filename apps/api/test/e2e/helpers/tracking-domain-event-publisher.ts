import { Logger } from "@nestjs/common";
import type { EventEmitter2 } from "@nestjs/event-emitter";
import type { DomainEventPublisherPort } from "@/shared/application/ports";
import type { DomainEvent } from "@/shared/domain/aggregate-root";

/**
 * E2E 전용 도메인 이벤트 퍼블리셔 (추적 데코레이터)
 *
 * 프로덕션 퍼블리셔와 동일하게 커밋 후 fire-and-forget으로 발행하되,
 * `emitAsync`가 반환하는 리스너 프라미스를 pending set에 등록해 테스트
 * reset이 TRUNCATE 전에 잔류 이벤트 작업을 drain할 수 있게 한다.
 * (미대기 이벤트 부수효과가 다음 테스트의 TRUNCATE와 경합하는 플레이크 방지.
 *  inline await는 하지 않으므로 발행 시점의 타이밍 의미는 프로덕션과 동일.)
 */
export class TrackingDomainEventPublisher implements DomainEventPublisherPort {
	readonly #logger = new Logger(TrackingDomainEventPublisher.name);
	readonly #pending = new Set<Promise<unknown>>();

	constructor(private readonly eventEmitter: EventEmitter2) {}

	publishAll(events: readonly DomainEvent[]): void {
		for (const event of events) {
			const settled: Promise<unknown> = this.eventEmitter
				.emitAsync(event.eventName, event)
				.catch((error) => {
					this.#logger.error(
						`Failed to publish domain event ${event.eventName}: ${error}`,
						error instanceof Error ? error.stack : undefined,
					);
				})
				.finally(() => {
					this.#pending.delete(settled);
				});
			this.#pending.add(settled);
		}
	}

	/** 진행 중인 이벤트 리스너 작업이 전부 정착할 때까지 대기 (핸들러의 연쇄 발행 포함) */
	async drainPendingEvents(): Promise<void> {
		let rounds = 0;
		while (this.#pending.size > 0) {
			rounds += 1;
			if (rounds > 25) {
				throw new Error(
					"Domain event drain exceeded 25 rounds — 이벤트 연쇄 루프 의심",
				);
			}
			await Promise.allSettled([...this.#pending]);
		}
	}
}
