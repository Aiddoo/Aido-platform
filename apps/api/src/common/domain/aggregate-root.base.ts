/**
 * 도메인 이벤트 — 프레임워크 비의존 구조적 타입
 *
 * @nestjs/cqrs의 IEvent와 구조적으로 호환되므로 발행 측(EventBus.publishAll)에서
 * 어댑테이션 없이 사용할 수 있습니다.
 */
export type DomainEvent = object;

/**
 * 애그리게잇 루트 베이스 (프레임워크 제로 의존)
 *
 * - 상태 전이 메서드에서 `this.apply(event)`로 도메인 이벤트를 적립하고,
 * - 핸들러가 저장(트랜잭션 커밋) **이후** `pullDomainEvents()`로 드레인해
 *   `EventBus.publishAll()`로 발행합니다.
 *   (기존 "트랜잭션 커밋 후 enqueue" 규칙과 등가)
 */
export abstract class AggregateRoot<
	TProps,
	TEvent extends DomainEvent = DomainEvent,
> {
	#domainEvents: TEvent[] = [];

	protected constructor(protected readonly props: TProps) {}

	/** 도메인 이벤트를 적립합니다 (발행은 커밋 후 핸들러 책임). */
	protected apply(event: TEvent): void {
		this.#domainEvents.push(event);
	}

	/**
	 * 적립된 이벤트를 적립 순서대로 반환하고 내부 버퍼를 비웁니다.
	 *
	 * 재호출 시 빈 배열을 반환하므로 중복 발행이 원천 차단됩니다.
	 */
	pullDomainEvents(): TEvent[] {
		const events = this.#domainEvents;
		this.#domainEvents = [];
		return events;
	}
}
