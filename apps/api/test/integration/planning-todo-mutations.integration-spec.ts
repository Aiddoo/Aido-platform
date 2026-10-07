import { ErrorCode } from "@aido/api/errors";
import type { SqlMiddleware } from "@prisma/orm-postgres/family-runtime";
import postgres from "@prisma/orm-postgres/runtime";
import { omit } from "es-toolkit";
import { Pool } from "pg";
import sql from "sql-template-tag";

import type { Contract } from "#api/generated/prisma8/contract.d";
import {
  TODO_REPOSITORY,
  type TodoRepositoryPort,
} from "#api/modules/planning/application/ports/todos/todo.repository.port";
import { AddTodoItem } from "#api/modules/planning/application/use-cases/todos/add-todo-item.use-case";
import { CreateRecurringTodos } from "#api/modules/planning/application/use-cases/todos/create-recurring-todos.use-case";
import { ReorderTodoItems } from "#api/modules/planning/application/use-cases/todos/reorder-todo-items.use-case";
import { ToggleTodoComplete } from "#api/modules/planning/application/use-cases/todos/toggle-todo-complete.use-case";
import { TodoToggledEvent } from "#api/modules/planning/domain/events/todos/todo-toggled.event";
import { encodeCreate } from "#api/platform/database/database-records";
import { sqlStatement } from "#api/platform/database/database-sql";
import { utcTimestampParameters } from "#api/platform/database/database-timestamp.middleware";
import { createEntityId } from "#api/platform/database/database-values";
import { DatabaseRecordNotFoundError } from "#api/platform/database/prisma-error.util";
import {
  DOMAIN_EVENT_PUBLISHER,
  UNIT_OF_WORK,
  type DomainEventPublisherPort,
  type UnitOfWorkPort,
} from "#api/shared/application/ports/index";
import { UserFixture, TodoFixture, TodoCategoryFixture } from "#test/fixtures/index";
import { withDatabaseTransaction } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

import contractJson from "../../src/generated/prisma8/contract.json" with { type: "json" };
import {
  createE2eApp,
  destroyE2eApp,
  type E2eTestContext,
} from "../e2e/helpers/e2e-app-factory.js";

const AT = new Date("2027-01-04T12:00:00.000Z");
interface Statement {
  readonly sql: string;
  readonly path: "query" | "execute";
}

function statementSummary(statements: readonly Statement[]) {
  const business = statements.filter(
    ({ sql }) => !/^(BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE)\b/i.test(sql.trim()),
  );
  const locks = business.filter(({ sql }) => sql.includes("pg_advisory_xact_lock"));
  return { total: business.length, orm: business.length - locks.length, locks: locks.length };
}

describe("Todo 변경 원자성·native ORM 실행 수 (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;
  let context: E2eTestContext;
  let userId: string;
  let todoId: number;
  let categoryId: number;
  let recording: Statement[] | null = null;

  beforeAll(async () => {
    const trace: SqlMiddleware = {
      name: "planning-statement-observer",
      familyId: "sql",
      async afterQuery(plan, result) {
        if (recording !== null && result.source === "driver")
          recording.push({ sql: plan.sql, path: "query" });
      },
      async afterExecute(plan, result) {
        if (recording !== null && result.source === "driver")
          recording.push({ sql: plan.sql, path: "execute" });
      },
    };
    database = new TestDatabase({
      createClient(url) {
        const pool = new Pool({ connectionString: url, max: 6 });
        const native = postgres<Contract>({
          contractJson,
          pg: pool,
          middleware: [utcTimestampParameters, trace],
        });
        let closed = false;
        return {
          ...native,
          async close() {
            if (closed) return;
            closed = true;
            await native.close();
            await pool.end();
          },
        };
      },
    });
    client = await database.start();
    context = await createE2eApp({ testDatabase: database });
  });
  beforeEach(async () => {
    recording = null;
    await context.reset();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(AT);
    const user = UserFixture.create({
      id: createEntityId(),
      email: "planning-mutations@example.com",
      userTag: "PLANPG01",
    });
    await client.orm.public.User.create(encodeCreate("User", user));
    userId = user.id;
    const category = await client.orm.public.TodoCategory.create(
      encodeCreate(
        "TodoCategory",
        omit(TodoCategoryFixture.create({ userId, sortOrder: 0 }), ["id"]),
      ),
    );
    categoryId = category.id;
    todoId = await createTodo();
  });
  afterEach(() => {
    recording = null;
    vi.useRealTimers();
  });
  afterAll(async () => {
    if (context) await destroyE2eApp(context);
    else await database?.stop();
  });

  async function createTodo() {
    const todo = await client.orm.public.Todo.create(
      encodeCreate(
        "Todo",
        omit(
          TodoFixture.create({ userId, categoryId, completed: false, startDate: AT, sortOrder: 0 }),
          ["id"],
        ),
      ),
    );
    return todo.id;
  }

  async function createItems(count: number) {
    await client.orm.public.TodoItem.createAndCount(
      Array.from({ length: count }, (_, sortOrder) =>
        encodeCreate("TodoItem", { todoId, title: `항목 ${sortOrder}`, sortOrder }),
      ),
    );
    return client.orm.public.TodoItem.where({ todoId })
      .select("id", "sortOrder")
      .orderBy((row) => row.sortOrder.asc())
      .all();
  }

  async function holdTodoRow() {
    const acquired = Promise.withResolvers<void>();
    const released = Promise.withResolvers<void>();
    const holding = withDatabaseTransaction(client, async (transaction) => {
      await transaction.query(
        sqlStatement(transaction, sql`SELECT "id" FROM "Todo" WHERE "id"=${todoId} FOR UPDATE`)
          .returnsRow({ id: "pg/int4@1" })
          .build(),
      );
      acquired.resolve();
      await released.promise;
    });
    await Promise.race([
      acquired.promise,
      holding.then(() => {
        throw new Error("Todo 잠금이 경쟁 요청보다 먼저 종료됨");
      }),
    ]);
    return async () => {
      released.resolve();
      await holding;
    };
  }

  async function waitForBlockedRequests(count: number) {
    await vi.waitFor(
      async () => {
        const waiting = await client.runtime().query(
          client.raw.sql`
        SELECT count(*)::int AS count FROM pg_stat_activity
        WHERE datname=current_database() AND wait_event_type='Lock'
      `
            .returnsRow({ count: "pg/int4@1" })
            .build(),
        );
        expect(waiting[0]?.count).toBe(count);
      },
      { timeout: 5000, interval: 10 },
    );
  }

  async function contend<T>(first: () => Promise<T>, second: () => Promise<T>) {
    const release = await holdTodoRow();
    const outcomes = Promise.allSettled([first(), second()]);
    try {
      await waitForBlockedRequests(2);
    } finally {
      await release();
      await outcomes;
    }
    return outcomes;
  }

  it("19개 item에 동시 추가하면 하나만 성공하고 20개·고유 sortOrder를 유지한다", async () => {
    // Given
    await createItems(19);
    const add = context.module.get(AddTodoItem);
    // When
    const outcomes = await contend(
      () => add.execute({ todoId, userId, title: "첫 요청" }),
      () => add.execute({ todoId, userId, title: "두 번째 요청" }),
    );
    const items = await client.orm.public.TodoItem.where({ todoId }).select("sortOrder").all();
    // Then
    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.find((outcome) => outcome.status === "rejected")?.reason).toMatchObject({
      errorCode: ErrorCode.TODO_0821,
      details: { currentCount: 20, maxPerTodo: 20 },
    });
    expect(items).toHaveLength(20);
    expect(new Set(items.map((item) => item.sortOrder)).size).toBe(20);
  });

  it("동일한 완료 요청 두 개는 모두 응답하되 실제 완료 이벤트는 한 번 발행한다", async () => {
    // Given
    const publisher = context.module.get<DomainEventPublisherPort>(DOMAIN_EVENT_PUBLISHER);
    const publishAll = vi.spyOn(publisher, "publishAll");
    const toggle = context.module.get(ToggleTodoComplete);
    // When
    const outcomes = await contend(
      () => toggle.execute({ id: todoId, userId, completed: true, timezone: "Asia/Seoul" }),
      () => toggle.execute({ id: todoId, userId, completed: true, timezone: "Asia/Seoul" }),
    );
    // Then
    expect(outcomes.every((outcome) => outcome.status === "fulfilled")).toBe(true);
    expect(
      publishAll.mock.calls
        .flatMap(([events]) => events)
        .filter((event) => event instanceof TodoToggledEvent),
    ).toHaveLength(1);
    expect(
      await client.orm.public.Todo.where({ id: todoId }).select("completed", "completedAt").first(),
    ).toMatchObject({ completed: true });
  });

  it("한 Todo의 잠금 대기는 같은 사용자의 다른 Todo item 추가를 막지 않는다", async () => {
    // Given
    const otherTodoId = await createTodo();
    const add = context.module.get(AddTodoItem);
    const release = await holdTodoRow();
    const blocked = add.execute({ todoId, userId, title: "대기 중" });
    // When
    try {
      await waitForBlockedRequests(1);
      const response = await add.execute({ todoId: otherTodoId, userId, title: "독립 요청" });
      // Then
      expect(response.items.map((item) => item.title)).toEqual(["독립 요청"]);
      await waitForBlockedRequests(1);
    } finally {
      await release();
      await blocked;
    }
  });

  it("item 재정렬 도중 not-found면 앞서 적용한 순서도 rollback한다", async () => {
    // Given
    const items = await createItems(2);
    const first = items.at(0);
    if (first === undefined) throw new Error("item fixture 누락");
    const repository = context.module.get<TodoRepositoryPort>(TODO_REPOSITORY);
    const unitOfWork = context.module.get<UnitOfWorkPort>(UNIT_OF_WORK);
    // When
    const result = unitOfWork.run(() => repository.reorderItems([first.id, 999999]));
    // Then
    await expect(result).rejects.toBeInstanceOf(DatabaseRecordNotFoundError);
    expect(
      await client.orm.public.TodoItem.where({ todoId })
        .select("id", "sortOrder")
        .orderBy((row) => row.sortOrder.asc())
        .all(),
    ).toEqual(items);
  });

  it("부분 수정은 명시적 null·false를 저장하고 undefined는 이전 값을 유지한다", async () => {
    // Given
    const repository = context.module.get<TodoRepositoryPort>(TODO_REPOSITORY);
    const unitOfWork = context.module.get<UnitOfWorkPort>(UNIT_OF_WORK);
    await unitOfWork.run(() =>
      repository.updateDetails(todoId, {
        title: "기존 제목",
        completed: true,
        completedAt: AT,
        endDate: new Date("2027-01-05"),
      }),
    );
    // When
    await unitOfWork.run(() =>
      repository.updateDetails(todoId, {
        title: undefined,
        completed: false,
        completedAt: null,
        endDate: null,
      }),
    );
    // Then
    const row = await client.orm.public.Todo.where({ id: todoId })
      .select("title", "completed", "completedAt", "endDate")
      .first();
    expect(row).toEqual({ title: "기존 제목", completed: false, completedAt: null, endDate: null });
  });

  it("3개 item 재정렬은 PK 선행 조회 없이 3번 수정하며 잠금 포함 6 SQL로 완료한다", async () => {
    // Given
    const items = await createItems(3);
    const itemIds = items.map((item) => item.id).reverse();
    const statements: Statement[] = [];
    recording = statements;
    // When
    const response = await context.module
      .get(ReorderTodoItems)
      .execute({ todoId, userId, itemIds });
    recording = null;
    // Then
    expect(response.items.map((item) => item.id)).toEqual(itemIds);
    expect(statementSummary(statements)).toEqual({ total: 6, orm: 5, locks: 1 });
    expect(statements.filter(({ sql }) => /^SELECT "TodoItem"/.test(sql))).toHaveLength(0);
    process.stdout.write(
      `PLANNING_QUERY_AFTER_RESULT ${JSON.stringify({ scenario: "reorder-3-items", ...statementSummary(statements), fixture: { items: 3 }, transactionControlsExcluded: true })}\n`,
    );
  });

  it("반복 부모 3개와 item 6개는 각 한 번의 bulk INSERT와 잠금 포함 7 SQL로 저장한다", async () => {
    // Given
    await client.orm.public.Todo.where({ id: todoId }).deleteAndCount();
    const statements: Statement[] = [];
    recording = statements;
    // When
    const response = await context.module.get(CreateRecurringTodos).execute({
      timezone: "Asia/Seoul",
      data: {
        userId,
        categoryId,
        title: "반복 생성",
        startDate: "2027-01-04",
        endDate: "2027-01-06",
        daysOfWeek: ["MON", "TUE", "WED"],
        scheduledTime: null,
        isAllDay: true,
        visibility: "PUBLIC",
        items: [{ title: "첫 항목" }, { title: "둘째 항목" }],
      },
    });
    recording = null;
    // Then
    expect(response.count).toBe(3);
    expect(response.todos.map((todo) => todo.items.map((item) => item.title))).toEqual(
      Array.from({ length: 3 }, () => ["첫 항목", "둘째 항목"]),
    );
    expect(response.todos.map((todo) => todo.sortOrder)).toEqual([0, 1, 2]);
    expect(statementSummary(statements)).toEqual({ total: 7, orm: 6, locks: 1 });
    expect(
      statements.filter(({ sql }) => /^INSERT INTO "public"\."TodoItem"/.test(sql)),
    ).toHaveLength(1);
    process.stdout.write(
      `PLANNING_QUERY_AFTER_RESULT ${JSON.stringify({ scenario: "recurring-3-todos-2-items", ...statementSummary(statements), fixture: { parents: 3, itemsPerParent: 2 }, transactionControlsExcluded: true })}\n`,
    );
  });

  it("반복 item 저장이 실패하면 부모 bulk 생성도 rollback한다", async () => {
    // Given
    const repository = context.module.get<TodoRepositoryPort>(TODO_REPOSITORY);
    const unitOfWork = context.module.get<UnitOfWorkPort>(UNIT_OF_WORK);
    const before = await client.orm.public.Todo.where({ userId }).select("id").all();
    // When
    const result = unitOfWork.run(() =>
      repository.createMany(
        [
          {
            userId,
            categoryId,
            title: "rollback 대상",
            startDate: AT,
            sortOrder: 1,
            isAllDay: true,
            visibility: "PUBLIC",
          },
        ],
        "00000000-0000-4000-8000-000000000701",
        [{ title: "x".repeat(201) }],
      ),
    );
    // Then
    await expect(result).rejects.toThrow();
    expect(await client.orm.public.Todo.where({ userId }).select("id").all()).toEqual(before);
    expect(await client.orm.public.TodoItem.select("id").all()).toEqual([]);
  });
});
