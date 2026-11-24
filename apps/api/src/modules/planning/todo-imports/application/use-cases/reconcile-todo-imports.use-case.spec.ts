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
  createTodoImportItemFixture,
  TODO_IMPORT_FIXTURE_NOW,
  TODO_IMPORT_FIXTURE_OTHER_USER_ID,
} from "#test/fixtures/planning/todo-import.fixture";

import { TodoImportId } from "../../domain/todo-import-id.vo.js";
import type { TodoImport } from "../../domain/todo-import.aggregate.js";
import { TodoImportMaterializationQueueAdapter } from "../../infrastructure/jobs/todo-import-materialization-queue.adapter.js";
import { TODO_IMPORT_MATERIALIZATION_QUEUE } from "../../infrastructure/jobs/todo-import-materialization.queue.js";
import { TodoImportUndoQueueAdapter } from "../../infrastructure/jobs/todo-import-undo-queue.adapter.js";
import { TODO_IMPORT_UNDO_QUEUE } from "../../infrastructure/jobs/todo-import-undo.queue.js";
import { TodoImportAlerts } from "../todo-imports.alerts.js";
import { ReconcileTodoImportsUseCase } from "./reconcile-todo-imports.use-case.js";

const NOW = TODO_IMPORT_FIXTURE_NOW.add({ hours: 48 });

function importAt(params: {
  readonly status: TodoImport["status"];
  readonly minutesAgo: number;
  readonly recoveryCount?: number;
  readonly userId?: string;
}): TodoImport {
  return createTodoImportFixture({
    id: TodoImportId.generate().value,
    userId: params.userId,
    status: params.status,
    round: 2,
    recoveryCount: params.recoveryCount ?? 0,
    committedAt: params.status === "UPLOADING" ? null : TODO_IMPORT_FIXTURE_NOW,
    updatedAt: NOW.subtract({ minutes: params.minutesAgo }),
  });
}

function setUp(imports: readonly TodoImport[]) {
  const todoImportRepository = new InMemoryTodoImportRepository(imports);
  const itemRepository = new InMemoryTodoImportItemRepository();
  const jobQueue = new InMemoryJobQueue();
  const alert = new RecordingOperationalAlert();
  const useCase = new ReconcileTodoImportsUseCase({
    unitOfWork: new ImmediateUnitOfWork(),
    mutationLock: new RecordingMutationLock(),
    todoImportRepository,
    itemRepository,
    materializationQueue: new TodoImportMaterializationQueueAdapter(jobQueue),
    undoQueue: new TodoImportUndoQueueAdapter(jobQueue),
    alert,
    clock: new FixedClock(NOW),
    logger: new SilentLogger(),
  });
  return { useCase, todoImportRepository, itemRepository, jobQueue, alert };
}

describe("ReconcileTodoImportsUseCase", () => {
  it("10분 넘게 진행이 없는 작업은 round를 올려 다시 넣고, 최근에 움직인 작업은 두지 않는다", async () => {
    // Given
    const stalled = importAt({ status: "RUNNING", minutesAgo: 11 });
    const moving = importAt({
      status: "QUEUED",
      minutesAgo: 5,
      userId: TODO_IMPORT_FIXTURE_OTHER_USER_ID,
    });
    const { useCase, todoImportRepository, jobQueue } = setUp([stalled, moving]);

    // When
    const result = await useCase.execute();

    // Then
    expect(result).toEqual({ recoveredCount: 1, failedCount: 0, abandonedCount: 0 });
    expect((await todoImportRepository.findById(stalled.id))?.toPrimitives()).toMatchObject({
      round: 3,
      recoveryCount: 1,
    });
    expect(jobQueue.jobsIn(TODO_IMPORT_MATERIALIZATION_QUEUE).map((job) => job.payload)).toEqual([
      { importId: stalled.id.value, round: 3 },
    ]);
  });

  it("되돌리는 중에 멈췄으면 되돌리기 작업을 처음부터 다시 넣는다", async () => {
    // Given
    const undoing = importAt({ status: "UNDOING", minutesAgo: 30 });
    const { useCase, jobQueue } = setUp([undoing]);

    // When
    await useCase.execute();

    // Then
    expect(jobQueue.jobsIn(TODO_IMPORT_UNDO_QUEUE).map((job) => job.payload)).toEqual([
      { importId: undoing.id.value, round: 3, afterTodoId: null },
    ]);
  });

  it("세 번 다시 넣어도 멈춰 있으면 FAILED로 닫고 경보를 올린다", async () => {
    // Given
    const stuck = importAt({ status: "QUEUED", minutesAgo: 20, recoveryCount: 3 });
    const { useCase, todoImportRepository, jobQueue, alert } = setUp([stuck]);

    // When
    const result = await useCase.execute();

    // Then
    expect(result.failedCount).toBe(1);
    expect((await todoImportRepository.findById(stuck.id))?.toPrimitives()).toMatchObject({
      status: "FAILED",
      failureReason: "STALLED",
    });
    expect(jobQueue.jobs).toEqual([]);
    expect(alert.alerts).toEqual([
      expect.objectContaining({
        key: TodoImportAlerts.STALLED.key,
        details: { importId: stuck.id.value },
      }),
    ]);
  });

  it("하루 넘게 업로드가 멈춘 가져오기는 ABANDONED로 닫고 받아 둔 일정을 지운다", async () => {
    // Given
    const abandoned = importAt({ status: "UPLOADING", minutesAgo: 24 * 60 + 1 });
    const recent = importAt({
      status: "UPLOADING",
      minutesAgo: 23 * 60,
      userId: TODO_IMPORT_FIXTURE_OTHER_USER_ID,
    });
    const { useCase, todoImportRepository, itemRepository } = setUp([abandoned, recent]);
    await itemRepository.insertMany(abandoned.id, [createTodoImportItemFixture("a")]);

    // When
    const result = await useCase.execute();

    // Then
    expect(result.abandonedCount).toBe(1);
    expect((await todoImportRepository.findById(abandoned.id))?.status).toBe("ABANDONED");
    expect((await todoImportRepository.findById(recent.id))?.status).toBe("UPLOADING");
    expect(await itemRepository.listPending(abandoned.id, 10)).toEqual([]);
  });
});
