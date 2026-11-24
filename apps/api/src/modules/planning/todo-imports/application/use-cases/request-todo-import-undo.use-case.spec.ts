import { ErrorCode } from "@aido/api/errors";

import { InMemoryTodoImportRepository } from "#test/doubles/planning/in-memory-todo-import.repository";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";
import { InMemoryJobQueue } from "#test/doubles/platform/in-memory-job-queue";
import { RecordingMutationLock } from "#test/doubles/platform/recording-mutation-lock";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import {
  createTodoImportFixture,
  TODO_IMPORT_FIXTURE_NOW,
  TODO_IMPORT_FIXTURE_USER_ID,
} from "#test/fixtures/planning/todo-import.fixture";

import type { TodoImport } from "../../domain/todo-import.aggregate.js";
import { TodoImportUndoQueueAdapter } from "../../infrastructure/jobs/todo-import-undo-queue.adapter.js";
import { TODO_IMPORT_UNDO_QUEUE } from "../../infrastructure/jobs/todo-import-undo.queue.js";
import { RequestTodoImportUndoUseCase } from "./request-todo-import-undo.use-case.js";

function setUp(todoImports: readonly TodoImport[], now: Temporal.Instant) {
  const jobQueue = new InMemoryJobQueue();
  const todoImportRepository = new InMemoryTodoImportRepository(todoImports);
  const useCase = new RequestTodoImportUndoUseCase({
    unitOfWork: new ImmediateUnitOfWork(),
    mutationLock: new RecordingMutationLock(),
    todoImportRepository,
    undoQueue: new TodoImportUndoQueueAdapter(jobQueue),
    clock: new FixedClock(now),
    logger: new SilentLogger(),
  });
  return { useCase, jobQueue, todoImportRepository };
}

describe("RequestTodoImportUndoUseCase", () => {
  it("완료 뒤 7일 안이면 되돌리는 중으로 바꾸고 작업을 한 번만 넣는다", async () => {
    // Given
    const todoImport = createTodoImportFixture({
      status: "COMPLETED",
      completedAt: TODO_IMPORT_FIXTURE_NOW,
      createdCount: 5,
      round: 3,
    });
    const { useCase, jobQueue } = setUp([todoImport], TODO_IMPORT_FIXTURE_NOW.add({ hours: 24 }));
    const command = { userId: TODO_IMPORT_FIXTURE_USER_ID, importId: todoImport.id.value };

    // When
    const requested = await useCase.execute(command);
    const again = await useCase.execute(command);

    // Then
    expect([requested.status, again.status]).toEqual(["UNDOING", "UNDOING"]);
    expect(jobQueue.jobsIn(TODO_IMPORT_UNDO_QUEUE).map((job) => job.payload)).toEqual([
      { importId: todoImport.id.value, round: 3, afterTodoId: null },
    ]);
  });

  it("7일이 지나면 서버가 정한 마감과 함께 2308이다", async () => {
    // Given
    const todoImport = createTodoImportFixture({
      status: "COMPLETED",
      completedAt: TODO_IMPORT_FIXTURE_NOW,
      createdCount: 5,
    });
    const { useCase, jobQueue } = setUp(
      [todoImport],
      TODO_IMPORT_FIXTURE_NOW.add({ hours: 24 * 8 }),
    );

    // When
    const result = useCase.execute({
      userId: TODO_IMPORT_FIXTURE_USER_ID,
      importId: todoImport.id.value,
    });

    // Then
    await expect(result).rejects.toMatchObject({
      errorCode: ErrorCode.TODO_IMPORT_2308,
      details: { undoableUntil: "2026-12-01T03:00:00.000Z" },
    });
    expect(jobQueue.jobs).toEqual([]);
  });

  it("다른 가져오기가 진행 중이면 2301과 그 id를 준다", async () => {
    // Given
    const completed = createTodoImportFixture({
      status: "COMPLETED",
      completedAt: TODO_IMPORT_FIXTURE_NOW,
      createdCount: 5,
    });
    const uploading = createTodoImportFixture({
      id: "c00000000000000000000000b",
      idempotencyKey: "start-key-2",
      status: "UPLOADING",
    });
    const { useCase, jobQueue, todoImportRepository } = setUp(
      [completed, uploading],
      TODO_IMPORT_FIXTURE_NOW.add({ hours: 1 }),
    );

    // When
    const result = useCase.execute({
      userId: TODO_IMPORT_FIXTURE_USER_ID,
      importId: completed.id.value,
    });

    // Then
    await expect(result).rejects.toMatchObject({
      errorCode: ErrorCode.TODO_IMPORT_2301,
      details: { importId: uploading.id.value },
    });
    expect((await todoImportRepository.findById(completed.id))?.status).toBe("COMPLETED");
    expect(jobQueue.jobs).toEqual([]);
  });
});
