import { AggregateRoot } from "./aggregate-root.js";
import type { DomainEvent } from "./domain-event.js";
import { EntityId } from "./entity-id.js";

class TaskId extends EntityId<number> {
  static reconstitute(value: number): TaskId {
    return new TaskId(value);
  }
}

interface TaskEvent extends DomainEvent {
  readonly eventName: "test.task.created" | "test.task.renamed";
  readonly title: string;
}

interface TaskProps {
  title: string;
}

class Task extends AggregateRoot<TaskId, TaskProps, TaskEvent> {
  static create(id: number, title: string): Task {
    const task = new Task(TaskId.reconstitute(id), { title });
    task.raise({ eventName: "test.task.created", title });
    return task;
  }

  rename(title: string): boolean {
    if (this.props.title === title) {
      return false;
    }
    this.props.title = title;
    this.raise({ eventName: "test.task.renamed", title });
    return true;
  }
}

describe("AggregateRoot — 애그리게잇 루트 베이스", () => {
  it("적립한 이벤트를 적립 순서대로 돌려준다", () => {
    // Given
    const task = Task.create(1, "장보기");
    task.rename("장보기: 우유");

    // When
    const events = task.pullDomainEvents();

    // Then
    expect(events.map((event) => event.eventName)).toEqual([
      "test.task.created",
      "test.task.renamed",
    ]);
  });

  it("두 번째로 꺼내면 빈 배열이라 같은 이벤트를 두 번 발행하지 않는다", () => {
    // Given
    const task = Task.create(1, "장보기");
    task.pullDomainEvents();

    // When
    const events = task.pullDomainEvents();

    // Then
    expect(events).toEqual([]);
  });
});
