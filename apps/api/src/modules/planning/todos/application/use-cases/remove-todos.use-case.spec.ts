import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { FakeTodoCache } from "#test/doubles/planning/fake-todo-cache";
import { InMemoryTodoBulkRemover } from "#test/doubles/planning/in-memory-todo-bulk-remover";
import { RecordingDomainEventPublisher } from "#test/doubles/planning/recording-domain-event-publisher";
import { RecordingTodoReminderScheduler } from "#test/doubles/planning/recording-todo-reminder-scheduler";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { RecordingAfterCommitRegistry } from "#test/doubles/platform/recording-after-commit-registry";
import {
  createPlanningTodoRecordFixture,
  type PlanningTodoRecord,
} from "#test/fixtures/planning/todo-response.fixture";
import {
  TODO_FIXTURE_NOW,
  TODO_FIXTURE_OTHER_USER_ID,
  TODO_FIXTURE_USER_ID,
} from "#test/fixtures/planning/todo.fixture";

import { TodoId } from "../../domain/todo-id.vo.js";
import { todoChangedPayloadSchema } from "../../domain/todo-published-events.constants.js";
import { RemoveTodosUseCase } from "./remove-todos.use-case.js";

const USER_ID = UserId.reconstitute(TODO_FIXTURE_USER_ID);

function setUp(records: readonly PlanningTodoRecord[]) {
  const todoRecords = new Map(records.map((record) => [record.id, record]));
  const reminderScheduler = new RecordingTodoReminderScheduler();
  const eventPublisher = new RecordingDomainEventPublisher();
  const todoCache = new FakeTodoCache();
  const afterCommit = new RecordingAfterCommitRegistry();
  const useCase = new RemoveTodosUseCase({
    bulkRemover: new InMemoryTodoBulkRemover({ todoRecords, seriesStore: new Map() }),
    reminderScheduler,
    eventPublisher,
    todoCache,
    afterCommit,
    clock: new FixedClock(TODO_FIXTURE_NOW),
  });
  return { todoRecords, reminderScheduler, eventPublisher, todoCache, afterCommit, useCase };
}

describe("RemoveTodosUseCase", () => {
  it("그 사용자의 완료하지 않은 할 일만 지우고 시각 있던 것의 알림을 한 번에 취소하며 삭제 사실을 한 번에 알린다", async () => {
    // Given
    const { todoRecords, reminderScheduler, eventPublisher, todoCache, afterCommit, useCase } =
      setUp([
        createPlanningTodoRecordFixture({
          id: 10,
          userId: TODO_FIXTURE_USER_ID,
          scheduledTime: TODO_FIXTURE_NOW,
        }),
        createPlanningTodoRecordFixture({ id: 11, userId: TODO_FIXTURE_USER_ID }),
        createPlanningTodoRecordFixture({ id: 12, userId: TODO_FIXTURE_OTHER_USER_ID }),
        createPlanningTodoRecordFixture({ id: 14, userId: TODO_FIXTURE_USER_ID, completed: true }),
      ]);
    todoCache.categoryUsers.add(TODO_FIXTURE_USER_ID);

    // When
    const result = await useCase.execute({
      userId: USER_ID,
      todoIds: [10, 11, 12, 13, 14].map((id) => TodoId.reconstitute(id)),
    });
    await afterCommit.runAll();

    // Then
    expect(result).toEqual({ todoCount: 2 });
    expect([...todoRecords.keys()]).toEqual([12, 14]);
    expect(reminderScheduler.cancelled).toEqual([10]);
    expect(
      eventPublisher.publishedEvents.map((fact) => [
        fact.eventName,
        todoChangedPayloadSchema.parse(fact.toPayload()).todoId,
      ]),
    ).toEqual([
      ["planning.todo.deleted", 10],
      ["planning.todo.deleted", 11],
    ]);
    expect(todoCache.categoryUsers.has(TODO_FIXTURE_USER_ID)).toBe(false);
    expect(todoCache.generations.get(TODO_FIXTURE_USER_ID)).toBe(1);
  });

  it("지울 할 일이 없으면 알림·사실·캐시 정리를 하지 않는다", async () => {
    // Given
    const { reminderScheduler, eventPublisher, afterCommit, useCase } = setUp([
      createPlanningTodoRecordFixture({ id: 12, userId: TODO_FIXTURE_OTHER_USER_ID }),
    ]);

    // When
    const result = await useCase.execute({ userId: USER_ID, todoIds: [TodoId.reconstitute(12)] });

    // Then
    expect(result).toEqual({ todoCount: 0 });
    expect(reminderScheduler.cancelled).toEqual([]);
    expect(eventPublisher.publishedEvents).toEqual([]);
    expect(afterCommit.tasks).toEqual([]);
  });
});
