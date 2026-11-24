import { sql } from "drizzle-orm";
import { chunk, omit } from "es-toolkit";

import { TodoImportId } from "#api/modules/planning/todo-imports/domain/todo-import-id.vo";
import { DrizzleTodoImportItemRepository } from "#api/modules/planning/todo-imports/infrastructure/persistence/drizzle-todo-import-item.repository";
import { DrizzleTodoImportLinkRepository } from "#api/modules/planning/todo-imports/infrastructure/persistence/drizzle-todo-import-link.repository";
import { DrizzleTodoImportRepository } from "#api/modules/planning/todo-imports/infrastructure/persistence/drizzle-todo-import.repository";
import {
  todo,
  todoCategory,
  todoImport,
  todoImportItem,
  todoImportLink,
  user,
} from "#api/platform/database/schema/index";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { createUserRowFixture } from "#test/fixtures/identity/user-row.fixture";
import {
  createTodoImportFixture,
  hashedKey,
  TODO_IMPORT_FIXTURE_COLLECTION_KEY,
  TODO_IMPORT_FIXTURE_NOW,
  TODO_IMPORT_FIXTURE_TODAY,
} from "#test/fixtures/planning/todo-import.fixture";
import {
  createTodoCategoryRowFixture,
  createTodoRowFixture,
} from "#test/fixtures/planning/todo-row.fixture";
import { createDatabaseTransactionFixture, createTestClient } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

const USER_COUNT = 400;
const IMPORTS_WITH_ITEMS = 20;
const ITEMS_PER_IMPORT = 3000;
const LINKED_TODO_COUNT = 20_000;
const INSERT_CHUNK = 2000;

interface CapturedStatement {
  readonly query: string;
  readonly params: unknown[];
}

// 운영 쿼리가 의도한 색인을 타는지 실제 저장소가 보낸 SQL 그대로 EXPLAIN한다(규모는 가져오기 20건·항목 6만·링크 2만)
describe("가져오기 핫 쿼리 실행 계획 (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;
  const captured: CapturedStatement[] = [];
  const userIds = Array.from(
    { length: USER_COUNT },
    (_, index) => `cplanuser${String(index).padStart(16, "0")}`,
  );
  const [targetUserId = ""] = userIds;
  let pendingImportId = "";

  beforeAll(async () => {
    database = new TestDatabase({
      createClient: (connectionUri) =>
        createTestClient(connectionUri, {}, (query, params) => {
          captured.push({ query, params });
        }),
    });
    client = await database.start();
    await database.cleanup();
    await seed();
    await client.execute(sql`ANALYZE`);
  }, 120_000);

  afterAll(async () => {
    await database.cleanup();
    await database.stop();
  });

  async function seed(): Promise<void> {
    await client
      .insert(user)
      .values(
        userIds.map((id, index) =>
          createUserRowFixture({ id, userTag: `QP${String(index).padStart(6, "0")}` }),
        ),
      );
    const imports = userIds.flatMap((userId, index) => [
      createTodoImportFixture({
        id: TodoImportId.generate().value,
        userId,
        idempotencyKey: "ended",
        status: "COMPLETED",
        updatedAt: TODO_IMPORT_FIXTURE_NOW.subtract({ hours: index }),
      }).toPrimitives(),
      createTodoImportFixture({
        id: TodoImportId.generate().value,
        userId,
        idempotencyKey: "undone",
        status: "UNDONE",
      }).toPrimitives(),
    ]);
    const active = createTodoImportFixture({
      id: TodoImportId.generate().value,
      userId: targetUserId,
      status: "RUNNING",
    }).toPrimitives();
    pendingImportId = active.id;
    await client.insert(todoImport).values([...imports, active]);
    const itemImportIds = [
      active.id,
      ...imports.slice(0, IMPORTS_WITH_ITEMS - 1).map((row) => row.id),
    ];
    const items = itemImportIds.flatMap((importId) =>
      Array.from({ length: ITEMS_PER_IMPORT }, (_, index) => ({
        importId,
        sourceKey: hashedKey(`${importId}:${index}`),
        collectionKey: TODO_IMPORT_FIXTURE_COLLECTION_KEY,
        title: `일정 ${index}`,
        startDate: TODO_IMPORT_FIXTURE_TODAY.add({ days: index % 300 }),
        endDate: null,
        localTime: "09:00",
        // 진행 중 가져오기는 절반이 남았고 끝난 가져오기는 모두 처리했다
        status:
          importId === active.id && index % 2 === 0 ? ("PENDING" as const) : ("CREATED" as const),
      })),
    );
    for (const rows of chunk(items, INSERT_CHUNK)) {
      await client.insert(todoImportItem).values(rows);
    }
    const [category] = await client
      .insert(todoCategory)
      .values(omit(createTodoCategoryRowFixture({ userId: targetUserId }), ["id"]))
      .returning({ id: todoCategory.id });
    const linkedTodoIds: number[] = [];
    for (const rows of chunk(Array.from({ length: LINKED_TODO_COUNT }), INSERT_CHUNK)) {
      const inserted = await client
        .insert(todo)
        .values(
          rows.map(() =>
            omit(createTodoRowFixture({ userId: targetUserId, categoryId: category?.id ?? 0 }), [
              "id",
            ]),
          ),
        )
        .returning({ id: todo.id });
      linkedTodoIds.push(...inserted.map((row) => row.id));
    }
    for (const rows of chunk(linkedTodoIds, INSERT_CHUNK)) {
      await client.insert(todoImportLink).values(
        rows.map((todoId) => ({
          todoId,
          userId: targetUserId,
          sourceKey: hashedKey(`link:${todoId}`),
          importId: imports[0]?.id ?? null,
          createdAt: TODO_IMPORT_FIXTURE_NOW,
        })),
      );
    }
  }

  async function explainLastStatement(run: () => Promise<unknown>): Promise<string> {
    captured.length = 0;
    await run();
    const statement = captured.at(-1);
    if (statement == null) {
      throw new Error("no statement captured");
    }
    const result = await client.$client.query(`EXPLAIN ${statement.query}`, statement.params);
    return result.rows.map((row: { "QUERY PLAN": string }) => row["QUERY PLAN"]).join("\n");
  }

  function transactionHost() {
    return createDatabaseTransactionFixture(client).transactionHost;
  }

  it("다음 묶음 고르기는 PENDING 부분 색인을 날짜·시각 순서 그대로 읽는다", async () => {
    // When
    const plan = await explainLastStatement(() =>
      new DrizzleTodoImportItemRepository(transactionHost()).listPending(
        TodoImportId.reconstitute(pendingImportId),
        101,
      ),
    );

    // Then
    expect(plan).toContain("TodoImportItem_importId_pending_idx");
  });

  it("이미 가져온 일정 확인은 (userId, sourceKey) 유니크 색인을 쓴다", async () => {
    // When
    const plan = await explainLastStatement(() =>
      new DrizzleTodoImportLinkRepository(transactionHost()).listLinkedSourceKeys(
        UserId.reconstitute(targetUserId),
        Array.from({ length: 100 }, (_, index) => hashedKey(`probe:${index}`)),
      ),
    );

    // Then
    expect(plan).toContain("TodoImportLink_userId_sourceKey_key");
  });

  it("진행 중 가져오기 찾기는 진행 중 부분 유니크 색인을 쓴다", async () => {
    // When
    const plan = await explainLastStatement(() =>
      new DrizzleTodoImportRepository(transactionHost()).findActiveByUserId(
        UserId.reconstitute(targetUserId),
      ),
    );

    // Then
    expect(plan).toContain("TodoImport_userId_active_key");
  });
});
