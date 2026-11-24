import { ErrorCode } from "@aido/api/errors";

import { TodoCategoryLockKeys } from "#api/modules/planning/todo-categories/planning-todo-categories.public";
import { TodoLockKeys } from "#api/modules/planning/todos/planning-todos.public";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { FakeTodoImportCategories } from "#test/doubles/planning/fake-todo-import-categories";
import { InMemoryTodoImportRepository } from "#test/doubles/planning/in-memory-todo-import.repository";
import { FixedClock } from "#test/doubles/platform/fixed-clock";
import { ImmediateUnitOfWork } from "#test/doubles/platform/immediate-unit-of-work";
import { InMemoryJobQueue } from "#test/doubles/platform/in-memory-job-queue";
import { RecordingMutationLock } from "#test/doubles/platform/recording-mutation-lock";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { createEntitlementFixture } from "#test/fixtures/access/entitlement.fixture";
import {
  createTodoImportFixture,
  TODO_IMPORT_FIXTURE_COLLECTION_KEY,
  TODO_IMPORT_FIXTURE_NOW,
  TODO_IMPORT_FIXTURE_TODAY,
  TODO_IMPORT_FIXTURE_USER_ID,
} from "#test/fixtures/planning/todo-import.fixture";

import type { TodoImport } from "../../domain/todo-import.aggregate.js";
import { TodoImportMaterializationQueueAdapter } from "../../infrastructure/jobs/todo-import-materialization-queue.adapter.js";
import { TODO_IMPORT_MATERIALIZATION_QUEUE } from "../../infrastructure/jobs/todo-import-materialization.queue.js";
import { TodoImportLockKeys } from "../todo-imports.lock-keys.js";
import { AssertTodoImportTargetsUseCase } from "./assert-todo-import-targets.use-case.js";
import { CommitTodoImportUseCase } from "./commit-todo-import.use-case.js";

const USER_ID = UserId.reconstitute(TODO_IMPORT_FIXTURE_USER_ID);

function setUp(todoImport: TodoImport, options: { readonly subscriptionStatus?: string } = {}) {
  const clock = new FixedClock(TODO_IMPORT_FIXTURE_NOW);
  const entitlements = createEntitlementFixture(
    { subscriptionStatus: options.subscriptionStatus ?? "FREE" },
    { clock },
  );
  const categories = new FakeTodoImportCategories([{ id: 41, name: "업무" }]);
  const todoImportRepository = new InMemoryTodoImportRepository([todoImport]);
  const jobQueue = new InMemoryJobQueue();
  const mutationLock = new RecordingMutationLock();
  const useCase = new CommitTodoImportUseCase({
    unitOfWork: new ImmediateUnitOfWork(),
    mutationLock,
    todoImportRepository,
    entitlementReader: entitlements.reader,
    assertTargets: new AssertTodoImportTargetsUseCase({
      categoryReader: categories.reader,
      categoryCreator: categories.creator,
      entitlementReader: entitlements.reader,
    }),
    categoryCreator: categories.creator,
    materializationQueue: new TodoImportMaterializationQueueAdapter(jobQueue),
    clock,
    logger: new SilentLogger(),
  });
  return { useCase, categories, jobQueue, mutationLock, todoImportRepository };
}

describe("CommitTodoImportUseCase", () => {
  it("가져오기·카테고리·정렬 순서로 잠근 뒤 새 카테고리를 만들고 같은 트랜잭션에 round 0 작업을 넣는다", async () => {
    // Given
    const todoImport = createTodoImportFixture({
      receivedItemCount: 5,
      targets: [
        {
          kind: "NEW_CATEGORY",
          targetKey: "school",
          name: "학교",
          color: "#FF0000",
          categoryId: null,
        },
      ],
      collections: [
        {
          collectionKey: TODO_IMPORT_FIXTURE_COLLECTION_KEY,
          targetKey: "school",
          expectedItemCount: 5,
        },
      ],
    });
    const { useCase, categories, jobQueue, mutationLock } = setUp(todoImport);

    // When
    const committed = await useCase.execute({
      userId: TODO_IMPORT_FIXTURE_USER_ID,
      importId: todoImport.id.value,
    });

    // Then
    expect(committed.status).toBe("QUEUED");
    expect(committed.collections).toEqual([
      { collectionKey: TODO_IMPORT_FIXTURE_COLLECTION_KEY, categoryId: 101 },
    ]);
    expect(categories.created).toEqual([{ name: "학교", color: "#FF0000" }]);
    expect(mutationLock.acquiredKeys).toEqual([
      [TodoImportLockKeys.userImports(USER_ID)],
      [TodoCategoryLockKeys.userCategories(USER_ID.value), TodoLockKeys.sortOrder(USER_ID.value)],
    ]);
    expect(jobQueue.jobsIn(TODO_IMPORT_MATERIALIZATION_QUEUE)).toEqual([
      {
        queue: TODO_IMPORT_MATERIALIZATION_QUEUE.name,
        payload: { importId: todoImport.id.value, round: 0 },
        options: {
          idempotencyKey: `todo-import:${todoImport.id.value}:0`,
          executionKey: todoImport.id.value,
        },
      },
    ]);
  });

  it("이미 확정한 가져오기를 다시 확정하면 카테고리·작업을 더 만들지 않고 지금 상태를 준다", async () => {
    // Given
    const todoImport = createTodoImportFixture({
      status: "RUNNING",
      committedAt: TODO_IMPORT_FIXTURE_NOW,
    });
    const { useCase, categories, jobQueue } = setUp(todoImport);

    // When
    const committed = await useCase.execute({
      userId: TODO_IMPORT_FIXTURE_USER_ID,
      importId: todoImport.id.value,
    });

    // Then
    expect(committed.status).toBe("RUNNING");
    expect(categories.created).toEqual([]);
    expect(jobQueue.jobs).toEqual([]);
  });

  it("시작 뒤 구독이 끝나 기간이 무료 일 수를 넘으면 확정에서 2302이다", async () => {
    // Given
    const todoImport = createTodoImportFixture({
      endDate: TODO_IMPORT_FIXTURE_TODAY.add({ days: 90 }),
    });
    const { useCase, jobQueue } = setUp(todoImport, { subscriptionStatus: "EXPIRED" });

    // When
    const result = useCase.execute({
      userId: TODO_IMPORT_FIXTURE_USER_ID,
      importId: todoImport.id.value,
    });

    // Then
    await expect(result).rejects.toMatchObject({ errorCode: ErrorCode.TODO_IMPORT_2302 });
    expect(jobQueue.jobs).toEqual([]);
  });

  it("취소한 가져오기는 카테고리를 만들기 전에 2305로 막는다", async () => {
    // Given
    const todoImport = createTodoImportFixture({
      status: "CANCELED",
      targets: [
        {
          kind: "NEW_CATEGORY",
          targetKey: "work",
          name: "학교",
          color: "#FF0000",
          categoryId: null,
        },
      ],
    });
    const { useCase, categories } = setUp(todoImport);

    // When
    const result = useCase.execute({
      userId: TODO_IMPORT_FIXTURE_USER_ID,
      importId: todoImport.id.value,
    });

    // Then
    await expect(result).rejects.toMatchObject({
      errorCode: ErrorCode.TODO_IMPORT_2305,
      details: { status: "CANCELED" },
    });
    expect(categories.created).toEqual([]);
  });
});
