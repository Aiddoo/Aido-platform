import { TodoCategoryLockKeys } from "#api/modules/planning/todo-categories/planning-todo-categories.public";
import { TodoId } from "#api/modules/planning/todos/planning-todos-queries.public";
import { TodoLockKeys } from "#api/modules/planning/todos/planning-todos.public";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { FakeStagedTodoBatchCreator } from "#test/doubles/planning/fake-staged-todo-batch-creator";
import { InMemoryTodoImportItemRepository } from "#test/doubles/planning/in-memory-todo-import-item.repository";
import { InMemoryTodoImportLinkRepository } from "#test/doubles/planning/in-memory-todo-import-link.repository";
import { InMemoryTodoImportRepository } from "#test/doubles/planning/in-memory-todo-import.repository";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";
import { InMemoryJobQueue } from "#test/doubles/platform/in-memory-job-queue";
import { RecordingAfterCommitRegistry } from "#test/doubles/platform/recording-after-commit-registry";
import { RecordingMutationLock } from "#test/doubles/platform/recording-mutation-lock";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import {
  createTodoImportFixture,
  createTodoImportItemFixture,
  hashedKey,
  TODO_IMPORT_FIXTURE_CATEGORY_ID,
  TODO_IMPORT_FIXTURE_NOW,
  TODO_IMPORT_FIXTURE_TODAY,
  TODO_IMPORT_FIXTURE_USER_ID,
} from "#test/fixtures/planning/todo-import.fixture";

import type { TodoImportItem } from "../../domain/todo-import-item.vo.js";
import type { TodoImportPrimitives } from "../../domain/todo-import.aggregate.js";
import { TodoImportMaterializationQueueAdapter } from "../../infrastructure/jobs/todo-import-materialization-queue.adapter.js";
import { TODO_IMPORT_MATERIALIZATION_QUEUE } from "../../infrastructure/jobs/todo-import-materialization.queue.js";
import { TodoImportLockKeys } from "../todo-imports.lock-keys.js";
import { MaterializeTodoImportUseCase } from "./materialize-todo-import.use-case.js";

const USER_ID = UserId.reconstitute(TODO_IMPORT_FIXTURE_USER_ID);

async function setUp(params: {
  readonly todoImport?: Partial<TodoImportPrimitives>;
  readonly items: readonly TodoImportItem[];
}) {
  const todoImport = createTodoImportFixture({
    status: "QUEUED",
    committedAt: TODO_IMPORT_FIXTURE_NOW,
    timezone: "America/Los_Angeles",
    ...params.todoImport,
  });
  const todoImportRepository = new InMemoryTodoImportRepository([todoImport]);
  const itemRepository = new InMemoryTodoImportItemRepository();
  await itemRepository.insertMany(todoImport.id, params.items);
  const linkRepository = new InMemoryTodoImportLinkRepository();
  const batchCreator = new FakeStagedTodoBatchCreator();
  const jobQueue = new InMemoryJobQueue();
  const mutationLock = new RecordingMutationLock();
  const afterCommit = new RecordingAfterCommitRegistry();
  const useCase = new MaterializeTodoImportUseCase({
    unitOfWork: new ImmediateUnitOfWork(),
    mutationLock,
    todoImportRepository,
    itemRepository,
    linkRepository,
    batchCreator,
    afterCommit,
    materializationQueue: new TodoImportMaterializationQueueAdapter(jobQueue),
    clock: new FixedClock(TODO_IMPORT_FIXTURE_NOW),
    logger: new SilentLogger(),
  });
  return {
    useCase,
    todoImport,
    todoImportRepository,
    itemRepository,
    linkRepository,
    batchCreator,
    jobQueue,
    mutationLock,
    afterCommit,
  };
}

function itemsOn(count: number, dayOffset: number, prefix: string): TodoImportItem[] {
  return Array.from({ length: count }, (_, index) =>
    createTodoImportItemFixture(`${prefix}-${index}`, {
      startDate: TODO_IMPORT_FIXTURE_TODAY.add({ days: dayOffset }),
    }),
  );
}

describe("MaterializeTodoImportUseCase", () => {
  it("가까운 날짜부터 가져오기 시간대로 만들고 이미 가져온 일정·자리 없는 일정은 건너뛰어 센다", async () => {
    // Given
    const later = createTodoImportItemFixture("later", {
      startDate: TODO_IMPORT_FIXTURE_TODAY.add({ days: 3 }),
    });
    const sooner = createTodoImportItemFixture("sooner", {
      startDate: TODO_IMPORT_FIXTURE_TODAY.add({ days: 1 }),
    });
    const duplicate = createTodoImportItemFixture("duplicate");
    const setup = await setUp({ items: [later, duplicate, sooner] });
    await setup.linkRepository.insertMany([
      {
        todoId: TodoId.reconstitute(1),
        userId: USER_ID,
        sourceKey: duplicate.sourceKey,
        importId: setup.todoImport.id,
        createdAt: TODO_IMPORT_FIXTURE_NOW,
      },
    ]);
    setup.batchCreator.remainingByCategory.set(TODO_IMPORT_FIXTURE_CATEGORY_ID, 1);

    // When
    const result = await setup.useCase.execute({ importId: setup.todoImport.id.value, round: 0 });

    // Then
    const [call] = setup.batchCreator.calls;
    expect(result).toEqual({ kind: "completed" });
    expect(call?.timezone).toBe("America/Los_Angeles");
    expect(call?.drafts.map((draft) => draft.key)).toEqual([sooner.sourceKey, later.sourceKey]);
    expect(
      (await setup.todoImportRepository.findById(setup.todoImport.id))?.toPrimitives(),
    ).toMatchObject({
      status: "COMPLETED",
      createdCount: 1,
      skippedDuplicateCount: 1,
      skippedCapacityCount: 1,
      processedItemCount: 3,
      firstDate: sooner.startDate,
      completedAt: TODO_IMPORT_FIXTURE_NOW,
    });
    expect(setup.itemRepository.statusesOf(setup.todoImport.id)).toEqual(
      new Map([
        [later.sourceKey, "SKIPPED_CAPACITY"],
        [duplicate.sourceKey, "SKIPPED_DUPLICATE"],
        [sooner.sourceKey, "CREATED"],
      ]),
    );
    expect(await setup.linkRepository.listLinkedSourceKeys(USER_ID, [sooner.sourceKey])).toEqual(
      new Set([sooner.sourceKey]),
    );
    expect(setup.afterCommit.tasks).toHaveLength(1);
    expect(setup.mutationLock.acquiredKeys.slice(0, 2)).toEqual([
      [TodoImportLockKeys.userImports(USER_ID)],
      [TodoCategoryLockKeys.userCategories(USER_ID.value), TodoLockKeys.sortOrder(USER_ID.value)],
    ]);
  });

  it("날짜만 가져오면 시각을 버려 알림이 예약되지 않게 한다", async () => {
    // Given
    const setup = await setUp({
      todoImport: { timeMode: "DATE_ONLY", visibility: "PUBLIC" },
      items: [createTodoImportItemFixture("meeting", { localTime: "10:30" })],
    });

    // When
    await setup.useCase.execute({ importId: setup.todoImport.id.value, round: 0 });

    // Then
    expect(setup.batchCreator.calls[0]?.drafts).toEqual([
      expect.objectContaining({
        scheduledLocalTime: null,
        visibility: "PUBLIC",
        categoryId: expect.objectContaining({ value: TODO_IMPORT_FIXTURE_CATEGORY_ID }),
      }),
    ]);
  });

  it("round에서 1,000개를 만들면 다음 round 작업을 넣고 멈추며, 그 작업이 나머지를 끝낸다", async () => {
    // Given
    const setup = await setUp({ items: [...itemsOn(600, 0, "a"), ...itemsOn(450, 1, "b")] });
    const importId = setup.todoImport.id.value;

    // When
    const first = await setup.useCase.execute({ importId, round: 0 });
    const afterFirst = await setup.todoImportRepository.findById(setup.todoImport.id);
    const second = await setup.useCase.execute({ importId, round: 1 });

    // Then
    expect(first).toEqual({ kind: "continued", nextRound: 1 });
    expect(afterFirst?.toPrimitives()).toMatchObject({
      status: "RUNNING",
      processedItemCount: 1000,
    });
    expect(
      setup.jobQueue.jobsIn(TODO_IMPORT_MATERIALIZATION_QUEUE).map((job) => job.payload),
    ).toEqual([{ importId, round: 1 }]);
    expect(second).toEqual({ kind: "completed" });
    expect(
      (await setup.todoImportRepository.findById(setup.todoImport.id))?.toPrimitives(),
    ).toMatchObject({
      status: "COMPLETED",
      createdCount: 1050,
    });
  });

  it.each([
    { label: "지나간 round의 작업", todoImport: { status: "RUNNING", round: 2 } },
    { label: "취소한 가져오기", todoImport: { status: "CANCELED", committedAt: null } },
  ] as const)("$label는 아무것도 만들지 않고 멈춘다", async ({ todoImport }) => {
    // Given
    const setup = await setUp({ todoImport, items: [createTodoImportItemFixture("a")] });

    // When
    const result = await setup.useCase.execute({ importId: setup.todoImport.id.value, round: 0 });

    // Then
    expect(result).toEqual({ kind: "stopped" });
    expect(setup.batchCreator.calls).toEqual([]);
  });

  it("계정을 지워 가져오기가 없으면 할 일 없이 끝낸다", async () => {
    // Given
    const setup = await setUp({ items: [] });

    // When
    const result = await setup.useCase.execute({
      importId: hashedKey("gone").slice(0, 25),
      round: 0,
    });

    // Then
    expect(result).toEqual({ kind: "stopped" });
  });
});
