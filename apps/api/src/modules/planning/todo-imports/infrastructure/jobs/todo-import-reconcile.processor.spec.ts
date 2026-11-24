import { InMemoryTodoImportItemRepository } from "#test/doubles/planning/in-memory-todo-import-item.repository";
import { InMemoryTodoImportRepository } from "#test/doubles/planning/in-memory-todo-import.repository";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";
import { InMemoryJobQueue } from "#test/doubles/platform/in-memory-job-queue";
import { RecordingMutationLock } from "#test/doubles/platform/recording-mutation-lock";
import { RecordingOperationalAlert } from "#test/doubles/platform/recording-operational-alert";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import {
  createTodoImportFixture,
  TODO_IMPORT_FIXTURE_NOW,
} from "#test/fixtures/planning/todo-import.fixture";
import { suppressLogger } from "#test/setup/suppress-logger";

import { ReconcileTodoImportsUseCase } from "../../application/use-cases/reconcile-todo-imports.use-case.js";
import { TodoImportMaterializationQueueAdapter } from "./todo-import-materialization-queue.adapter.js";
import { TODO_IMPORT_MATERIALIZATION_QUEUE } from "./todo-import-materialization.queue.js";
import { TodoImportReconcileProcessor } from "./todo-import-reconcile.processor.js";
import { TODO_IMPORT_RECONCILE_QUEUE } from "./todo-import-reconcile.queue.js";
import { TodoImportReconcileScheduler } from "./todo-import-reconcile.scheduler.js";
import { TodoImportUndoQueueAdapter } from "./todo-import-undo-queue.adapter.js";

describe("TodoImportReconcileProcessor", () => {
  it("10분 주기 작업이 오면 worker가 죽어 멈춘 가져오기를 다시 넣는다", async () => {
    // Given
    const stalled = createTodoImportFixture({
      status: "RUNNING",
      committedAt: TODO_IMPORT_FIXTURE_NOW,
      updatedAt: TODO_IMPORT_FIXTURE_NOW,
    });
    const jobQueue = new InMemoryJobQueue();
    const reconcile = new ReconcileTodoImportsUseCase({
      unitOfWork: new ImmediateUnitOfWork(),
      mutationLock: new RecordingMutationLock(),
      todoImportRepository: new InMemoryTodoImportRepository([stalled]),
      itemRepository: new InMemoryTodoImportItemRepository(),
      materializationQueue: new TodoImportMaterializationQueueAdapter(jobQueue),
      undoQueue: new TodoImportUndoQueueAdapter(jobQueue),
      alert: new RecordingOperationalAlert(),
      clock: new FixedClock(TODO_IMPORT_FIXTURE_NOW.add({ minutes: 11 })),
      logger: new SilentLogger(),
    });
    const processor = new TodoImportReconcileProcessor(reconcile, jobQueue);
    await processor.onModuleInit();
    await jobQueue.enqueue(TODO_IMPORT_RECONCILE_QUEUE, {});

    // When
    await jobQueue.drain(TODO_IMPORT_RECONCILE_QUEUE);

    // Then
    expect(jobQueue.jobsIn(TODO_IMPORT_MATERIALIZATION_QUEUE).map((job) => job.payload)).toEqual([
      { importId: stalled.id.value, round: 1 },
    ]);
  });
});

describe("TodoImportReconcileScheduler", () => {
  beforeEach(suppressLogger);

  it("재조정을 매일 정리와 따로 10분마다 등록한다", async () => {
    // Given
    const jobQueue = new InMemoryJobQueue();
    const scheduler = new TodoImportReconcileScheduler(jobQueue);

    // When
    scheduler.onModuleInit();
    await scheduler.schedulerRegistration;

    // Then
    expect(jobQueue.scheduledQueues).toEqual(["planning.todo-import-reconcile.v1"]);
    expect(TODO_IMPORT_RECONCILE_QUEUE.schedules).toEqual([
      {
        key: "todo-import-reconcile-scheduler",
        cron: "*/10 * * * *",
        timezone: "UTC",
        missed: "skip",
        payload: {},
      },
    ]);
  });
});
