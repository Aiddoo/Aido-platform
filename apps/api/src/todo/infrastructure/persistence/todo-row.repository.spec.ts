/**
 * TodoRowRepository 단위 테스트
 *
 * Suites + Builder + GWT 패턴 적용
 * - Suites: 자동 Mock 생성
 * - Builder: TodoBuilder로 테스트 데이터 생성
 * - GWT: Given/When/Then 주석
 *
 * @see https://docs.nestjs.com/recipes/suites
 */
import { vi } from "vitest";

import { varchar } from "#api/shared/infrastructure/database/database-values";
import { TodoBuilder } from "#test/builders/index";
import {
  assertNativeWhere,
  createMockTransactionHost,
  databaseFixture,
  databaseWriteExpectation,
  nativeRows,
} from "#test/mocks/database.mock";
import { createMockDatabaseContext, type MockDatabaseContext } from "#test/mocks/index";

import { TodoRowRepository } from "./todo-row.repository.js";

describe("TodoRowRepository — 할 일 행 리포지토리(DAO)", () => {
  let repository: TodoRowRepository;
  let db: MockDatabaseContext;

  beforeEach(async () => {
    // ID 카운터 리셋
    TodoBuilder.resetIdCounter();

    // 리포지토리는 CLS TransactionHost.tx에서 클라이언트를 읽으므로
    // tx가 Prisma mock을 반환하도록 스텁합니다.
    db = createMockDatabaseContext();

    repository = new TodoRowRepository(createMockTransactionHost(db));
  });

  describe("createItem", () => {
    it("todoItem.create를 올바른 파라미터로 호출한다", async () => {
      // Given
      const todoId = 1;
      const data = { title: "세부 항목", sortOrder: 0 };
      const expected = {
        id: 10,
        todoId: 1,
        title: "세부 항목",
        completed: false,
        sortOrder: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      vi.mocked(db.orm.public.TodoItem.create).mockResolvedValue(
        databaseFixture("TodoItem", expected),
      );

      // When
      await repository.createItem(todoId, data);

      // Then
      expect(db.orm.public.TodoItem.create).toHaveBeenCalledWith(
        expect.objectContaining(
          databaseWriteExpectation("TodoItem", { todoId, title: "세부 항목", sortOrder: 0 }),
        ),
      );
    });
  });

  describe("updateItem", () => {
    it("todoItem.update를 올바른 파라미터로 호출한다", async () => {
      // Given
      const itemId = 10;
      const data = { title: "수정된 항목", completed: true };
      vi.mocked(db.orm.public.TodoItem.update).mockResolvedValue(
        databaseFixture("TodoItem", {
          id: 10,
          todoId: 1,
          title: "항목",
          completed: false,
          sortOrder: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      );

      // When
      await repository.updateItem(itemId, data);

      // Then
      expect(db.orm.public.TodoItem.update).toHaveBeenCalledWith(
        expect.objectContaining(
          databaseWriteExpectation("TodoItem", { title: "수정된 항목", completed: true }),
        ),
      );
    });
  });

  describe("deleteItem", () => {
    it("todoItem.delete를 올바른 파라미터로 호출한다", async () => {
      // Given
      const itemId = 10;
      vi.mocked(db.orm.public.TodoItem.delete).mockResolvedValue(
        databaseFixture("TodoItem", {
          id: 10,
          todoId: 1,
          title: "항목",
          completed: false,
          sortOrder: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      );

      // When
      await repository.deleteItem(itemId);

      // Then
      assertNativeWhere("TodoItem", db.orm.public.TodoItem.where.mock.calls.at(-1)?.[0], (row) =>
        row.id.eq(itemId),
      );
    });
  });

  describe("reorderItems", () => {
    it("각 itemId에 대해 update를 호출한다", async () => {
      // Given
      const itemIds = [30, 10, 20];
      vi.mocked(db.orm.public.TodoItem.update).mockResolvedValue(
        databaseFixture("TodoItem", {
          id: 10,
          todoId: 1,
          title: "항목",
          completed: false,
          sortOrder: 0,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      );

      // When
      await repository.reorderItems(itemIds);

      // Then
      expect(db.orm.public.TodoItem.update).toHaveBeenCalledTimes(3);
      expect(db.orm.public.TodoItem.update).toHaveBeenCalledWith(
        expect.objectContaining(databaseWriteExpectation("TodoItem", { sortOrder: 0 })),
      );
      expect(db.orm.public.TodoItem.update).toHaveBeenCalledWith(
        expect.objectContaining(databaseWriteExpectation("TodoItem", { sortOrder: 1 })),
      );
      expect(db.orm.public.TodoItem.update).toHaveBeenCalledWith(
        expect.objectContaining(databaseWriteExpectation("TodoItem", { sortOrder: 2 })),
      );
    });
  });

  describe("createManyBatch", () => {
    const recurrenceGroupId = "test-group-id";

    it("createMany로 일괄 INSERT 후 findMany로 조회한다", async () => {
      // Given
      db.orm.public.Todo.createAndCount.mockResolvedValue(2);
      db.orm.public.Todo.all.mockReturnValue(
        nativeRows(
          databaseFixture("Todo", [
            TodoBuilder.create("user-1").withId(1).build(),
            TodoBuilder.create("user-1").withId(2).build(),
          ]),
        ),
      );

      const dataArray = [
        {
          userId: "user-1",
          categoryId: 1,
          title: "할 일 1",
          sortOrder: 0,
          startDate: new Date("2024-01-15"),
          recurrenceGroupId,
        },
        {
          userId: "user-1",
          categoryId: 1,
          title: "할 일 2",
          sortOrder: 1,
          startDate: new Date("2024-01-16"),
          recurrenceGroupId,
        },
      ];

      // When
      const result = await repository.createManyBatch(dataArray, recurrenceGroupId);

      // Then - createMany가 전체 데이터로 호출됨
      expect(db.orm.public.Todo.createAndCount).toHaveBeenCalledWith(
        dataArray.map((data) => databaseWriteExpectation("Todo", data)),
      );

      // Then - findMany가 recurrenceGroupId로 조회됨
      assertNativeWhere("Todo", db.orm.public.Todo.where.mock.calls.at(-1)?.[0], (row) =>
        row.recurrenceGroupId.eq(varchar(recurrenceGroupId, 36)),
      );

      expect(result).toHaveLength(2);
    });
  });
});
