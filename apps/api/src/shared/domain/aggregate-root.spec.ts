/**
 * AggregateRoot 베이스 단위 테스트
 *
 * GWT 패턴 적용
 * - 도메인 이벤트 적립(raise) → pullDomainEvents 드레인 검증
 */

import { AggregateRoot } from "./aggregate-root";

class TestCreatedEvent {
	readonly eventName = "test.created";

	constructor(public readonly id: number) {}
}

class TestRenamedEvent {
	readonly eventName = "test.renamed";

	constructor(public readonly title: string) {}
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
		aggregate.raise(new TestCreatedEvent(props.id));
		return aggregate;
	}

	rename(title: string): void {
		this.props.title = title;
		this.raise(new TestRenamedEvent(title));
	}

	getTitle(): string {
		return this.props.title;
	}
}

describe("AggregateRoot — 애그리게잇 루트 베이스", () => {
	it("raise한 이벤트는 pullDomainEvents로 적립 순서대로 드레인된다", () => {
		// Given
		const aggregate = TestAggregate.create({ id: 1, title: "테스트" });
		aggregate.rename("변경");

		// When
		const events = aggregate.pullDomainEvents();

		// Then
		expect(events).toHaveLength(2);
		expect(events[0]).toBeInstanceOf(TestCreatedEvent);
		expect(events[1]).toBeInstanceOf(TestRenamedEvent);
	});

	it("pullDomainEvents 재호출 시 빈 배열을 반환한다 (중복 발행 차단)", () => {
		// Given
		const aggregate = TestAggregate.create({ id: 1, title: "테스트" });
		aggregate.pullDomainEvents();

		// When
		const second = aggregate.pullDomainEvents();

		// Then
		expect(second).toHaveLength(0);
	});

	it("드레인 후 새로 raise한 이벤트만 다음 드레인에 포함된다", () => {
		// Given
		const aggregate = TestAggregate.create({ id: 1, title: "테스트" });
		aggregate.pullDomainEvents();

		// When
		aggregate.rename("두번째");
		const events = aggregate.pullDomainEvents();

		// Then
		expect(events).toHaveLength(1);
		expect(events[0]).toBeInstanceOf(TestRenamedEvent);
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
