/**
 * AggregateRoot 베이스 단위 테스트
 *
 * GWT 패턴 적용
 * - 도메인 이벤트 적립(apply) → 커밋 전 미발행 → commit 시 발행 검증
 */

import type { IEvent } from "@nestjs/cqrs";
import { AggregateRoot } from "./aggregate-root.base";

class TestCreatedEvent implements IEvent {
	constructor(public readonly id: number) {}
}

interface TestProps {
	id: number;
	title: string;
}

class TestAggregate extends AggregateRoot<TestProps> {
	private constructor(props: TestProps) {
		super(props);
	}

	static create(props: TestProps): TestAggregate {
		const aggregate = new TestAggregate(props);
		aggregate.apply(new TestCreatedEvent(props.id));
		return aggregate;
	}

	getTitle(): string {
		return this.props.title;
	}
}

describe("AggregateRoot — 애그리게잇 루트 베이스", () => {
	it("apply한 이벤트는 commit 전까지 uncommitted 상태로 쌓인다", () => {
		// Given & When
		const aggregate = TestAggregate.create({ id: 1, title: "테스트" });

		// Then
		const events = aggregate.getUncommittedEvents();
		expect(events).toHaveLength(1);
		expect(events[0]).toBeInstanceOf(TestCreatedEvent);
	});

	it("commit하면 이벤트가 발행되고 uncommitted 목록이 비워진다", () => {
		// Given
		const aggregate = TestAggregate.create({ id: 1, title: "테스트" });
		// commit()이 내부 배열을 참조로 넘긴 뒤 비우므로 스파이에서 복사해 캡처
		const published: IEvent[] = [];
		aggregate.publishAll = (events: IEvent[]) => {
			published.push(...events);
		};

		// When
		aggregate.commit();

		// Then
		expect(published).toHaveLength(1);
		expect(published[0]).toBeInstanceOf(TestCreatedEvent);
		expect(aggregate.getUncommittedEvents()).toHaveLength(0);
	});

	it("props는 하위 클래스 getter로만 노출된다", () => {
		// Given
		const aggregate = TestAggregate.create({ id: 1, title: "제목" });

		// When
		const title = aggregate.getTitle();

		// Then
		expect(title).toBe("제목");
	});
});
