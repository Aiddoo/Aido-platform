import type { RemoveTodosCommand } from "#api/modules/planning/todos/application/use-cases/remove-todos.use-case";
import { TodoId } from "#api/modules/planning/todos/planning-todos-queries.public";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { InMemoryTodoImportLinkRepository } from "#test/doubles/planning/in-memory-todo-import-link.repository";
import { InMemoryTodoImportRepository } from "#test/doubles/planning/in-memory-todo-import.repository";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";
import { InMemoryJobQueue } from "#test/doubles/platform/in-memory-job-queue";
import { RecordingMutationLock } from "#test/doubles/platform/recording-mutation-lock";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import {
  createTodoImportFixture,
  hashedKey,
  TODO_IMPORT_FIXTURE_NOW,
  TODO_IMPORT_FIXTURE_USER_ID,
} from "#test/fixtures/planning/todo-import.fixture";

import { TodoImportUndoQueueAdapter } from "../../infrastructure/jobs/todo-import-undo-queue.adapter.js";
import { TODO_IMPORT_UNDO_QUEUE } from "../../infrastructure/jobs/todo-import-undo.queue.js";
import { UndoTodoImportUseCase } from "./undo-todo-import.use-case.js";

const USER_ID = UserId.reconstitute(TODO_IMPORT_FIXTURE_USER_ID);

async function setUp(todoCount: number, completedTodoIds: ReadonlySet<number>) {
  const todoImport = createTodoImportFixture({ status: "UNDOING", round: 2 });
  const todoImportRepository = new InMemoryTodoImportRepository([todoImport]);
  const linkRepository = new InMemoryTodoImportLinkRepository();
  const todoIds = Array.from({ length: todoCount }, (_, index) => index + 1);
  await linkRepository.insertMany(
    todoIds.map((todoId) => ({
      todoId: TodoId.reconstitute(todoId),
      userId: USER_ID,
      sourceKey: hashedKey(`event-${todoId}`),
      importId: todoImport.id,
      createdAt: TODO_IMPORT_FIXTURE_NOW,
    })),
  );
  const removeCalls: number[][] = [];
  // 실제처럼 완료하지 않은 할 일만 지우고, 지운 할 일의 링크는 FK cascade로 함께 사라진다
  const removeTodos = {
    execute: async (command: RemoveTodosCommand) => {
      const removable = command.todoIds
        .map((todoId) => todoId.value)
        .filter((todoId) => !completedTodoIds.has(todoId));
      removeCalls.push(removable);
      for (const todoId of removable) {
        linkRepository.removeTodo(todoId);
      }
      return { todoCount: removable.length };
    },
  };
  const jobQueue = new InMemoryJobQueue();
  const useCase = new UndoTodoImportUseCase({
    unitOfWork: new ImmediateUnitOfWork(),
    mutationLock: new RecordingMutationLock(),
    todoImportRepository,
    linkRepository,
    removeTodos,
    undoQueue: new TodoImportUndoQueueAdapter(jobQueue),
    clock: new FixedClock(TODO_IMPORT_FIXTURE_NOW),
    logger: new SilentLogger(),
  });
  return { useCase, todoImport, todoImportRepository, removeCalls, jobQueue };
}

describe("UndoTodoImportUseCase", () => {
  it("완료하지 않은 할 일만 200개씩 지우고 완료해서 남긴 수를 센 뒤 되돌리기를 마친다", async () => {
    // Given
    const { useCase, todoImport, todoImportRepository, removeCalls } = await setUp(
      450,
      new Set([5, 300]),
    );

    // When
    const result = await useCase.execute({
      importId: todoImport.id.value,
      round: 2,
      afterTodoId: null,
    });

    // Then
    expect(result).toEqual({ kind: "completed" });
    expect(removeCalls.map((call) => call.length)).toEqual([199, 199, 50]);
    expect((await todoImportRepository.findById(todoImport.id))?.toPrimitives()).toMatchObject({
      status: "UNDONE",
      undoneCount: 448,
      keptCompletedCount: 2,
    });
  });

  it("같은 round를 다시 실행해도 이미 지운 할 일을 두 번 세지 않는다", async () => {
    // Given
    const { useCase, todoImport, todoImportRepository } = await setUp(3, new Set([2]));
    const command = { importId: todoImport.id.value, round: 2, afterTodoId: null };
    await useCase.execute(command);

    // When
    const again = await useCase.execute(command);

    // Then
    expect(again).toEqual({ kind: "stopped" });
    expect((await todoImportRepository.findById(todoImport.id))?.toPrimitives()).toMatchObject({
      undoneCount: 2,
      keptCompletedCount: 1,
    });
  });

  it("round에서 1,000개를 넘기면 마지막 할 일 id 뒤부터 이어 갈 다음 round 작업을 넣는다", async () => {
    // Given
    const { useCase, todoImport, jobQueue } = await setUp(1200, new Set());

    // When
    const result = await useCase.execute({
      importId: todoImport.id.value,
      round: 2,
      afterTodoId: null,
    });

    // Then
    expect(result).toEqual({ kind: "continued", nextRound: 3 });
    expect(jobQueue.jobsIn(TODO_IMPORT_UNDO_QUEUE).map((job) => job.payload)).toEqual([
      { importId: todoImport.id.value, round: 3, afterTodoId: 1000 },
    ]);
  });
});
