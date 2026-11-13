import { asc, eq } from "drizzle-orm";
import { omit } from "es-toolkit";

import { ReorderTodoUseCase } from "#api/modules/planning/todos/application/use-cases/reorder-todo.use-case";
import { DrizzleTodoReadRepository } from "#api/modules/planning/todos/infrastructure/persistence/drizzle-todo-read.repository";
import { DrizzleTodoRepository } from "#api/modules/planning/todos/infrastructure/persistence/drizzle-todo.repository";
import { PostgresMutationLockAdapter } from "#api/platform/database/postgres-mutation-lock.adapter";
import { todo, todoCategory, user } from "#api/platform/database/schema/index";
import { createEntityId } from "#api/shared/domain/model/entity-id";
import { DateClock } from "#test/doubles/platform/date-clock";
import { SilentLogger } from "#test/doubles/platform/silent-logger";
import { TodoCategoryFixture, TodoFixture, UserFixture } from "#test/fixtures/index";
import { createDatabaseTransactionFixture, createTestClient } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

type Move = {
  readonly index: number;
  readonly targetIndex: number | null;
  readonly position: "before" | "after";
};

// 바꾸기 전 순서 의미: 옮길 할 일을 빼고 기준 바로 앞·뒤, 기준이 없으면 맨 앞·끝에 넣는다
function expectedOrder(order: readonly number[], id: number, target: number | null, move: Move) {
  const rest = order.filter((todoId) => todoId !== id);
  if (target === id) {
    return [...order];
  }
  if (target == null) {
    return move.position === "before" ? [id, ...rest] : [...rest, id];
  }
  const at = rest.indexOf(target) + (move.position === "after" ? 1 : 0);
  return [...rest.slice(0, at), id, ...rest.slice(at)];
}

describe("할 일 순서 바꾸기 — 간격 정수 (실제 PostgreSQL)", () => {
  let recording: string[] | null = null;
  const database = new TestDatabase({
    createClient: (url) =>
      createTestClient(url, { max: 4 }, (statement) => {
        recording?.push(statement);
      }),
  });
  let client: TestDatabaseClient;
  let useCase: ReorderTodoUseCase;
  let userId: string;
  let otherUserId: string;
  let categoryId: number;

  beforeAll(async () => {
    client = await database.start();
    const { txHost, uow } = createDatabaseTransactionFixture(client);
    useCase = new ReorderTodoUseCase({
      todoRepository: new DrizzleTodoRepository(txHost, new DateClock()),
      todoReadRepository: new DrizzleTodoReadRepository(txHost),
      unitOfWork: uow,
      mutationLock: new PostgresMutationLockAdapter(txHost),
      todoCache: { invalidateFriendTodos: async () => undefined },
      logger: new SilentLogger(),
    });
  });

  beforeEach(async () => {
    recording = null;
    await database.cleanup();
    userId = createEntityId();
    await client.insert(user).values(UserFixture.create({ id: userId, userTag: "REORDER1" }));
    otherUserId = createEntityId();
    await client
      .insert(user)
      .values(
        UserFixture.create({ id: otherUserId, email: "other@example.com", userTag: "REORDER2" }),
      );
    const category = TodoCategoryFixture.create({ userId });
    await client.insert(todoCategory).values(category);
    categoryId = category.id;
    const otherCategory = TodoCategoryFixture.create({ userId: otherUserId });
    await client.insert(todoCategory).values(otherCategory);
    await client
      .insert(todo)
      .values(
        omit(
          TodoFixture.create({ userId: otherUserId, categoryId: otherCategory.id, sortOrder: 1 }),
          ["id"],
        ),
      );
  });

  afterAll(async () => {
    await database.stop();
  });

  async function seed(sortOrders: readonly number[]): Promise<number[]> {
    const rows = await client
      .insert(todo)
      .values(
        sortOrders.map((sortOrder) =>
          omit(TodoFixture.create({ userId, categoryId, sortOrder }), ["id"]),
        ),
      )
      .returning({ id: todo.id });
    return rows.map((row) => row.id);
  }

  async function currentOrder(): Promise<{ id: number; sortOrder: number }[]> {
    return client
      .select({ id: todo.id, sortOrder: todo.sortOrder })
      .from(todo)
      .where(eq(todo.userId, userId))
      .orderBy(asc(todo.sortOrder), asc(todo.id));
  }

  async function apply(ids: readonly number[], move: Move) {
    const id = ids[move.index] ?? 0;
    const target = move.targetIndex == null ? null : (ids[move.targetIndex] ?? 0);
    const before = (await currentOrder()).map((row) => row.id);
    const response = await useCase.execute({
      id,
      userId,
      targetTodoId: target ?? undefined,
      position: move.position,
    });
    return { id, target, before, response };
  }

  // 같은 이동 목록을 빽빽한 옛 순서(0,1,2…, 같은 값 포함)와 간격 순서 모두에 적용해 옛 의미와 비교한다
  it.each([
    { name: "간격 없는 옛 순서", sortOrders: [0, 1, 2, 3, 4, 5] },
    { name: "같은 값이 섞인 옛 순서", sortOrders: [0, 1, 1, 2, 2, 3] },
    { name: "간격 순서", sortOrders: [1024, 2048, 3072, 4096, 5120, 6144] },
    { name: "간격이 거의 찬 순서", sortOrders: [0, 2, 3, 5, 6, 8] },
  ])("$name에서 앞·뒤·맨 앞·맨 끝 이동이 옛 순서 의미와 같다", async ({ sortOrders }) => {
    // Given
    const ids = await seed(sortOrders);
    const moves: Move[] = [
      { index: 0, targetIndex: 3, position: "before" },
      { index: 5, targetIndex: 1, position: "before" },
      { index: 2, targetIndex: 4, position: "after" },
      { index: 4, targetIndex: null, position: "before" },
      { index: 1, targetIndex: null, position: "after" },
      { index: 3, targetIndex: 3, position: "after" },
      { index: 0, targetIndex: 5, position: "after" },
      { index: 5, targetIndex: 0, position: "after" },
    ];

    for (const move of moves) {
      // When
      const { id, target, before, response } = await apply(ids, move);

      // Then
      const after = await currentOrder();
      expect(after.map((row) => row.id)).toEqual(expectedOrder(before, id, target, move));
      expect(new Set(after.map((row) => row.sortOrder)).size).toBe(after.length);
      expect(after.every((row) => 0 <= row.sortOrder && row.sortOrder <= 2_147_483_647)).toBe(true);
      expect(response.id).toBe(id);
      expect(response.sortOrder).toBe(after.find((row) => row.id === id)?.sortOrder);
    }
  });

  it("간격이 있으면 옮긴 할 일 한 행만 쓰고 다른 행은 그대로다", async () => {
    // Given
    const ids = await seed([1024, 2048, 3072, 4096]);
    recording = [];

    // When
    await apply(ids, { index: 3, targetIndex: 1, position: "after" });

    // Then
    const todoUpdates = recording.filter((statement) => /^update "Todo"/i.test(statement));
    recording = null;
    expect(todoUpdates).toHaveLength(1);
    expect(await currentOrder()).toEqual([
      { id: ids[0], sortOrder: 1024 },
      { id: ids[1], sortOrder: 2048 },
      { id: ids[3], sortOrder: 2560 },
      { id: ids[2], sortOrder: 3072 },
    ]);
  });

  it("다른 사용자 할 일의 순서는 다시 매길 때도 건드리지 않는다", async () => {
    // Given
    const ids = await seed([0, 1, 2]);

    // When
    await apply(ids, { index: 2, targetIndex: 0, position: "after" });

    // Then
    const others = await client
      .select({ sortOrder: todo.sortOrder })
      .from(todo)
      .where(eq(todo.userId, otherUserId));
    expect(others).toEqual([{ sortOrder: 1 }]);
  });

  it("같은 사용자의 동시 순서 바꾸기는 사용자 잠금으로 차례로 반영돼 값이 겹치지 않는다", async () => {
    // Given
    const ids = await seed([0, 1, 2, 3, 4, 5]);

    // When
    await Promise.all([
      apply(ids, { index: 0, targetIndex: null, position: "after" }),
      apply(ids, { index: 5, targetIndex: null, position: "before" }),
      apply(ids, { index: 2, targetIndex: 3, position: "after" }),
    ]);

    // Then
    const after = await currentOrder();
    expect(new Set(after.map((row) => row.sortOrder)).size).toBe(after.length);
    expect(after.at(0)?.id).toBe(ids[5]);
    expect(after.at(-1)?.id).toBe(ids[0]);
  });
});
