import type { DomainEvent } from "@/shared/domain/aggregate-root";

export const DOMAIN_EVENT_PUBLISHER = Symbol("DOMAIN_EVENT_PUBLISHER");

/**
 * 도메인 이벤트 발행 포트
 *
 * use-case가 트랜잭션 커밋 **이후** `pullDomainEvents()`로 드레인한 이벤트를
 * 발행하는 유일한 통로입니다. 벤더(EventEmitter2)는 인프라 어댑터 뒤에 숨습니다.
 *
 * 계약: 비동기 구독자 완료까지 관측하되 발행 실패는 호출자에게 전파하지 않습니다.
 * 커밋이 끝난 요청을 부수효과 오류로 실패시키지 않기 위함입니다.
 */
export interface DomainEventPublisherPort {
	publishAll(events: readonly DomainEvent[]): Promise<void>;
}
