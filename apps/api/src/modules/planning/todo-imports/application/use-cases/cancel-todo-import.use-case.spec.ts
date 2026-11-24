import { ErrorCode } from "@aido/api/errors";

import { InMemoryTodoImportItemRepository } from "#test/doubles/planning/in-memory-todo-import-item.repository";
import { InMemoryTodoImportRepository } from "#test/doubles/planning/in-memory-todo-import.repository";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";
import { RecordingMutationLock } from "#test/doubles/platform/recording-mutation-lock";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import {
  createTodoImportFixture,
  createTodoImportItemFixture,
  TODO_IMPORT_FIXTURE_NOW,
  TODO_IMPORT_FIXTURE_USER_ID,
} from "#test/fixtures/planning/todo-import.fixture";

import type { TodoImport } from "../../domain/todo-import.aggregate.js";
import { CancelTodoImportUseCase } from "./cancel-todo-import.use-case.js";

async function setUp(todoImport: TodoImport) {
  const itemRepository = new InMemoryTodoImportItemRepository();
  await itemRepository.insertMany(todoImport.id, [createTodoImportItemFixture("a")]);
  const useCase = new CancelTodoImportUseCase({
    unitOfWork: new ImmediateUnitOfWork(),
    mutationLock: new RecordingMutationLock(),
    todoImportRepository: new InMemoryTodoImportRepository([todoImport]),
    itemRepository,
    clock: new FixedClock(TODO_IMPORT_FIXTURE_NOW),
    logger: new SilentLogger(),
  });
  return { useCase, itemRepository };
}

describe("CancelTodoImportUseCase", () => {
  it("업로드 중이면 취소하고 받아 둔 일정을 지우며, 다시 취소해도 같은 결과다", async () => {
    // Given
    const todoImport = createTodoImportFixture();
    const { useCase, itemRepository } = await setUp(todoImport);
    const command = { userId: TODO_IMPORT_FIXTURE_USER_ID, importId: todoImport.id.value };

    // When
    const canceled = await useCase.execute(command);
    const again = await useCase.execute(command);

    // Then
    expect([canceled.status, again.status]).toEqual(["CANCELED", "CANCELED"]);
    expect(await itemRepository.listPending(todoImport.id, 10)).toEqual([]);
  });

  it("확정한 가져오기는 취소할 수 없다", async () => {
    // Given
    const todoImport = createTodoImportFixture({ status: "QUEUED" });
    const { useCase, itemRepository } = await setUp(todoImport);

    // When
    const result = useCase.execute({
      userId: TODO_IMPORT_FIXTURE_USER_ID,
      importId: todoImport.id.value,
    });

    // Then
    await expect(result).rejects.toMatchObject({
      errorCode: ErrorCode.TODO_IMPORT_2305,
      details: { status: "QUEUED" },
    });
    expect(await itemRepository.listPending(todoImport.id, 10)).toHaveLength(1);
  });
});
