import { ErrorCode } from "@aido/api/errors";
import { TODO_IMPORT_LIMITS } from "@aido/api/vocabulary";

import { InMemoryTodoImportItemRepository } from "#test/doubles/planning/in-memory-todo-import-item.repository";
import { InMemoryTodoImportRepository } from "#test/doubles/planning/in-memory-todo-import.repository";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";
import { RecordingMutationLock } from "#test/doubles/platform/recording-mutation-lock";
import {
  createTodoImportFixture,
  createTodoImportItemFixture,
  hashedKey,
  TODO_IMPORT_FIXTURE_NOW,
  TODO_IMPORT_FIXTURE_OTHER_USER_ID,
  TODO_IMPORT_FIXTURE_TODAY,
  TODO_IMPORT_FIXTURE_USER_ID,
} from "#test/fixtures/planning/todo-import.fixture";

import type { TodoImport } from "../../domain/todo-import.aggregate.js";
import { ReceiveTodoImportItemsUseCase } from "./receive-todo-import-items.use-case.js";

function setUp(todoImport: TodoImport) {
  const todoImportRepository = new InMemoryTodoImportRepository([todoImport]);
  const itemRepository = new InMemoryTodoImportItemRepository();
  const useCase = new ReceiveTodoImportItemsUseCase({
    unitOfWork: new ImmediateUnitOfWork(),
    mutationLock: new RecordingMutationLock(),
    todoImportRepository,
    itemRepository,
    clock: new FixedClock(TODO_IMPORT_FIXTURE_NOW),
  });
  return { useCase, todoImportRepository, itemRepository };
}

function itemsOf(...seeds: readonly string[]) {
  return seeds.map((seed) => createTodoImportItemFixture(seed).value);
}

describe("ReceiveTodoImportItemsUseCase", () => {
  it("이미 받은 일정 키는 세지 않아 끊긴 업로드를 다시 보내도 받은 수가 늘지 않는다", async () => {
    // Given
    const todoImport = createTodoImportFixture();
    const { useCase, todoImportRepository } = setUp(todoImport);
    const command = { userId: TODO_IMPORT_FIXTURE_USER_ID, importId: todoImport.id.value };
    await useCase.execute({ ...command, items: itemsOf("a", "b") });

    // When
    const resent = await useCase.execute({ ...command, items: itemsOf("a", "b", "c") });

    // Then
    expect(resent).toEqual({ acceptedCount: 1, receivedItemCount: 3 });
    expect((await todoImportRepository.findById(todoImport.id))?.receivedItemCount).toBe(3);
  });

  it.each([
    {
      reason: "UNKNOWN_COLLECTION",
      item: createTodoImportItemFixture("x", { collectionKey: hashedKey("other-calendar") }),
    },
    {
      reason: "ITEM_OUTSIDE_RANGE",
      item: createTodoImportItemFixture("x", {
        startDate: TODO_IMPORT_FIXTURE_TODAY.add({ days: 30 }),
      }),
    },
  ])(
    "$reason 일정이 있으면 그 위치와 함께 2306이고 아무것도 받지 않는다",
    async ({ reason, item }) => {
      // Given
      const todoImport = createTodoImportFixture();
      const { useCase, itemRepository } = setUp(todoImport);

      // When
      const result = useCase.execute({
        userId: TODO_IMPORT_FIXTURE_USER_ID,
        importId: todoImport.id.value,
        items: [...itemsOf("ok"), item.value],
      });

      // Then
      await expect(result).rejects.toMatchObject({
        errorCode: ErrorCode.TODO_IMPORT_2306,
        details: { reason, index: 1 },
      });
      expect(await itemRepository.listPending(todoImport.id, 10)).toEqual([]);
    },
  );

  it("누적이 가져오기 한도를 넘으면 2309이다", async () => {
    // Given
    const todoImport = createTodoImportFixture({
      receivedItemCount: TODO_IMPORT_LIMITS.MAX_ITEMS_PER_IMPORT - 1,
    });
    const { useCase } = setUp(todoImport);

    // When
    const result = useCase.execute({
      userId: TODO_IMPORT_FIXTURE_USER_ID,
      importId: todoImport.id.value,
      items: itemsOf("a", "b"),
    });

    // Then
    await expect(result).rejects.toMatchObject({
      errorCode: ErrorCode.TODO_IMPORT_2309,
      details: {
        limit: TODO_IMPORT_LIMITS.MAX_ITEMS_PER_IMPORT,
        receivedItemCount: TODO_IMPORT_LIMITS.MAX_ITEMS_PER_IMPORT + 1,
      },
    });
  });

  it.each([
    {
      label: "남의 가져오기",
      userId: TODO_IMPORT_FIXTURE_OTHER_USER_ID,
      status: "UPLOADING",
      code: ErrorCode.TODO_IMPORT_2304,
    },
    {
      label: "확정한 가져오기",
      userId: TODO_IMPORT_FIXTURE_USER_ID,
      status: "QUEUED",
      code: ErrorCode.TODO_IMPORT_2305,
    },
  ] as const)("받지 않는다: $label ($code)", async ({ userId, status, code }) => {
    // Given
    const todoImport = createTodoImportFixture({ status });
    const { useCase } = setUp(todoImport);

    // When
    const result = useCase.execute({ userId, importId: todoImport.id.value, items: itemsOf("a") });

    // Then
    await expect(result).rejects.toMatchObject({ errorCode: code });
  });
});
