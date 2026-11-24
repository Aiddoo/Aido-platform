import type { Todo as TodoResponse } from "@aido/api/contracts/todo/v1";
import { TODO_LIMITS } from "@aido/api/vocabulary";

import { TodoCategoryId } from "#api/modules/planning/todo-categories/planning-todo-categories.public";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { FakeTodoCache } from "#test/doubles/planning/fake-todo-cache";
import { InMemoryTodoOccurrenceWriter } from "#test/doubles/planning/in-memory-todo-occurrence-writer";
import {
  InMemoryTodoRepository,
  InMemoryTodoSequence,
} from "#test/doubles/planning/in-memory-todo.repository";
import { RecordingDomainEventPublisher } from "#test/doubles/planning/recording-domain-event-publisher";
import { RecordingTodoReminderScheduler } from "#test/doubles/planning/recording-todo-reminder-scheduler";
import { createStubCategoryOwnership } from "#test/doubles/planning/stub-category-ownership";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import {
  createPlanningTodoRecordFixture,
  type PlanningTodoRecord,
} from "#test/fixtures/planning/todo-response.fixture";
import {
  TODO_FIXTURE_NOW,
  TODO_FIXTURE_OTHER_USER_ID,
  TODO_FIXTURE_USER_ID,
} from "#test/fixtures/planning/todo.fixture";

import type { TodoBatchDraft } from "../ports/staged-todo-batch-creator.port.js";
import { ApplyTodoEventsUseCase } from "./apply-todo-events.use-case.js";
import { PublishTodoBatchCreatedUseCase } from "./publish-todo-batch-created.use-case.js";
import { StageTodoBatchCreationUseCase } from "./stage-todo-batch-creation.use-case.js";

const USER_ID = UserId.reconstitute(TODO_FIXTURE_USER_ID);
const OWN_CATEGORY_ID = 1;
const FOREIGN_CATEGORY_ID = 2;

function setUp(existing: readonly PlanningTodoRecord[] = []) {
  const records = new Map(existing.map((record) => [record.id, record]));
  const sequence = new InMemoryTodoSequence();
  const reminders = new RecordingTodoReminderScheduler();
  const eventPublisher = new RecordingDomainEventPublisher();
  const todoCache = new FakeTodoCache();
  const categories = new Map<number, TodoResponse["category"]>([
    [OWN_CATEGORY_ID, { id: OWN_CATEGORY_ID, name: "업무", color: "#FFB3B3", sortOrder: 0 }],
    [FOREIGN_CATEGORY_ID, { id: FOREIGN_CATEGORY_ID, name: "남", color: "#FFB3B3", sortOrder: 0 }],
  ]);
  const owners = new Map([
    [OWN_CATEGORY_ID, TODO_FIXTURE_USER_ID],
    [FOREIGN_CATEGORY_ID, TODO_FIXTURE_OTHER_USER_ID],
  ]);
  const clock = new FixedClock(TODO_FIXTURE_NOW);
  const useCase = new StageTodoBatchCreationUseCase({
    todoRepository: new InMemoryTodoRepository(records, new Map(), sequence),
    occurrenceWriter: new InMemoryTodoOccurrenceWriter(records, sequence),
    categoryOwnership: createStubCategoryOwnership(categories, owners),
    applyTodoEvents: new ApplyTodoEventsUseCase({
      reminderScheduler: reminders,
      eventPublisher,
      clock,
    }),
    publishBatchCreated: new PublishTodoBatchCreatedUseCase({
      todoCache,
      logger: new SilentLogger(),
    }),
    clock,
  });
  return { records, reminders, eventPublisher, todoCache, useCase };
}

function draft(overrides: Partial<TodoBatchDraft> & Pick<TodoBatchDraft, "key">): TodoBatchDraft {
  return {
    categoryId: TodoCategoryId.reconstitute(OWN_CATEGORY_ID),
    title: "회의",
    startDate: Temporal.PlainDate.from("2026-11-12"),
    endDate: null,
    scheduledLocalTime: null,
    visibility: "PRIVATE",
    ...overrides,
  };
}

function openTodosInOwnCategory(count: number): PlanningTodoRecord[] {
  return Array.from({ length: count }, (_, index) =>
    createPlanningTodoRecordFixture({
      id: index + 1,
      userId: TODO_FIXTURE_USER_ID,
      categoryId: OWN_CATEGORY_ID,
      sortOrder: (index + 1) * 1024,
    }),
  );
}

describe("StageTodoBatchCreationUseCase", () => {
  it("입력 순서대로 결과를 주고 잘못된 초안·남의 카테고리·자리 없는 초안은 이유와 함께 건너뛴다", async () => {
    // Given
    const usage = TODO_LIMITS.MAX_PER_CATEGORY - 2;
    const { records, useCase } = setUp(openTodosInOwnCategory(usage));

    // When
    const staged = await useCase.execute({
      userId: USER_ID,
      timezone: "Asia/Seoul",
      drafts: [
        draft({ key: "first" }),
        draft({ key: "empty-title", title: "" }),
        draft({ key: "ends-before-start", endDate: Temporal.PlainDate.from("2026-11-11") }),
        draft({ key: "foreign", categoryId: TodoCategoryId.reconstitute(FOREIGN_CATEGORY_ID) }),
        draft({ key: "second" }),
        draft({ key: "over-capacity" }),
      ],
    });

    // Then
    expect(
      staged.outcomes.map((outcome) =>
        outcome.kind === "created" ? [outcome.key, "created"] : [outcome.key, outcome.reason],
      ),
    ).toEqual([
      ["first", "created"],
      ["empty-title", "INVALID"],
      ["ends-before-start", "INVALID"],
      ["foreign", "CATEGORY_MISSING"],
      ["second", "created"],
      ["over-capacity", "CAPACITY"],
    ]);
    const created = staged.outcomes.flatMap((outcome) =>
      outcome.kind === "created" ? [records.get(outcome.todoId.value)] : [],
    );
    expect(created.map((record) => [record?.sortOrder, record?.visibility])).toEqual([
      [(usage + 1) * 1024, "PRIVATE"],
      [(usage + 2) * 1024, "PRIVATE"],
    ]);
  });

  it("벽시계는 넘겨받은 시간대로 순간을 만들고 서머타임 경계를 넘어도 그 날의 오프셋을 쓴다", async () => {
    // Given
    const { records, reminders, eventPublisher, useCase } = setUp();

    // When
    const staged = await useCase.execute({
      userId: USER_ID,
      timezone: "America/Los_Angeles",
      drafts: [
        draft({
          key: "before-dst-end",
          startDate: Temporal.PlainDate.from("2026-10-31"),
          scheduledLocalTime: "09:00",
        }),
        draft({
          key: "after-dst-end",
          startDate: Temporal.PlainDate.from("2026-11-02"),
          scheduledLocalTime: "09:00",
        }),
        draft({ key: "date-only", startDate: Temporal.PlainDate.from("2026-11-03") }),
      ],
    });

    // Then
    const createdIds = staged.outcomes.flatMap((outcome) =>
      outcome.kind === "created" ? [outcome.todoId.value] : [],
    );
    expect(
      createdIds.map((id) => [
        records.get(id)?.scheduledLocalTime,
        records.get(id)?.scheduledTime?.toString(),
        records.get(id)?.isAllDay,
      ]),
    ).toEqual([
      ["09:00", "2026-10-31T16:00:00Z", false],
      ["09:00", "2026-11-02T17:00:00Z", false],
      [null, undefined, true],
    ]);
    expect(reminders.scheduleBatches).toEqual([createdIds.slice(0, 2)]);
    expect(eventPublisher.publishedEvents.map((fact) => fact.eventName)).toEqual([
      "planning.todo.created",
      "planning.todo.created",
      "planning.todo.created",
    ]);
  });

  it("만들 초안이 없으면 저장·알림 없이 결과만 주고 커밋 뒤 작업은 사용자 묶음 키 하나로 캐시를 비운다", async () => {
    // Given
    const { records, reminders, eventPublisher, todoCache, useCase } = setUp();
    todoCache.categoryUsers.add(TODO_FIXTURE_USER_ID);

    // When
    const staged = await useCase.execute({
      userId: USER_ID,
      timezone: "Asia/Seoul",
      drafts: [draft({ key: "foreign", categoryId: TodoCategoryId.reconstitute(99) })],
    });
    await staged.afterCommit();

    // Then
    expect(staged.outcomes).toEqual([
      { kind: "rejected", key: "foreign", reason: "CATEGORY_MISSING" },
    ]);
    expect(records.size).toBe(0);
    expect(reminders.scheduleBatches).toEqual([]);
    expect(eventPublisher.publishedEvents).toEqual([]);
    expect(staged.afterCommitKey).toBe(`todo-batch:${TODO_FIXTURE_USER_ID}`);
    expect(todoCache.categoryUsers.has(TODO_FIXTURE_USER_ID)).toBe(false);
  });
});
