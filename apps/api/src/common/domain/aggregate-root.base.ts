import { AggregateRoot as CqrsAggregateRoot, type IEvent } from "@nestjs/cqrs";

/**
 * 애그리게잇 루트 베이스
 *
 * @nestjs/cqrs의 AggregateRoot를 확장해 props 캡슐화를 추가합니다.
 * - 상태 전이 메서드에서 `this.apply(event)`로 도메인 이벤트를 쌓고,
 * - 핸들러가 저장(트랜잭션 커밋) 이후 `commit()`을 호출해 이벤트를 발행합니다.
 *   (기존 "트랜잭션 커밋 후 enqueue" 규칙과 등가)
 */
export abstract class AggregateRoot<
	TProps,
	TEvent extends IEvent = IEvent,
> extends CqrsAggregateRoot<TEvent> {
	protected constructor(protected readonly props: TProps) {
		super();
	}
}
