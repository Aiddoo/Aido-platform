/**
 * 도메인 이벤트 — 프레임워크 비의존 구조적 타입
 *
 * `eventName`은 발행 채널(EventEmitter2)의 라우팅 키로 사용됩니다.
 * 각 이벤트 클래스가 인스턴스 필드로 선언합니다 (예: `"todo.created"`).
 */
export interface DomainEvent {
	readonly eventName: string;
}

/**
 * 애그리게잇 루트 베이스 (프레임워크 제로 의존)
 *
 * - 상태 전이 메서드에서 `this.raise(event)`로 도메인 이벤트를 적립하고,
 * - use-case가 저장(트랜잭션 커밋) **이후** `pullDomainEvents()`로 드레인해
 *   `DomainEventPublisherPort.publishAll()`로 발행합니다.
 *   (기존 "트랜잭션 커밋 후 enqueue" 규칙과 등가)
 *
 * 네이밍: 이벤트소싱의 `apply`(이벤트로 상태 재구성)와 구분하기 위해
 * "발생 사실 기록"을 뜻하는 `raise`를 사용합니다.
 */
export abstract class AggregateRoot<TProps, TEvent extends DomainEvent = DomainEvent> {
	#domainEvents: TEvent[] = [];

	protected constructor(protected readonly props: TProps) {}

	/** 도메인 이벤트를 적립합니다 (발행은 커밋 후 핸들러 책임). */
	protected raise(event: TEvent): void {
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
