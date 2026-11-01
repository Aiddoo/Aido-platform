import { ErrorCode } from "@aido/api/errors";
import { eq, sql } from "drizzle-orm";
import { omit } from "es-toolkit";

import {
  TODO_REPOSITORY,
  type TodoRepositoryPort,
} from "#api/modules/planning/application/ports/todos/todo.repository.port";
import { AddTodoItem } from "#api/modules/planning/application/use-cases/todos/add-todo-item.use-case";
import { CreateRecurringTodos } from "#api/modules/planning/application/use-cases/todos/create-recurring-todos.use-case";
import { ReorderTodoItems } from "#api/modules/planning/application/use-cases/todos/reorder-todo-items.use-case";
import { ToggleTodoComplete } from "#api/modules/planning/application/use-cases/todos/toggle-todo-complete.use-case";
import { TodoToggledEvent } from "#api/modules/planning/domain/events/todos/todo-toggled.event";
import { DatabaseRecordNotFoundError } from "#api/platform/database/database-error.util";
import { createEntityId } from "#api/platform/database/entity-id";
import {
  todo,
  todoCategory,
  todoItem,
  user as userTable,
} from "#api/platform/database/schema/index";
import {
  DOMAIN_EVENT_PUBLISHER,
  UNIT_OF_WORK,
  type DomainEventPublisherPort,
  type UnitOfWorkPort,
} from "#api/shared/application/ports/index";
import { UserFixture, TodoFixture, TodoCategoryFixture } from "#test/fixtures/index";
import { createTestClient } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

import {
  createE2eApp,
  destroyE2eApp,
  type E2eTestContext,
} from "../e2e/helpers/e2e-app-factory.js";

const AT = new Date("2027-01-04T12:00:00.000Z");
function statementSummary(statements: readonly string[]) {
  const business = statements.filter(
    (statement) => !/^(BEGIN|COMMIT|ROLLBACK|SAVEPOINT|RELEASE)\b/i.test(statement.trim()),
  );
  const locks = business.filter((statement) => statement.includes("pg_advisory_xact_lock"));
  return { total: business.length, orm: business.length - locks.length, locks: locks.length };
}

describe("Todo 변경 원자성·Drizzle 쿼리 실행 수 (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;
  let context: E2eTestContext;
  let userId: string;
  let todoId: number;
  let categoryId: number;
  let recording: string[] | null = null;

  beforeAll(async () => {
    database = new TestDatabase({
      createClient: (url) =>
        createTestClient(url, { max: 6 }, (statement) => {
          if (recording !== null) {
            recording.push(statement);
          }
        }),
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
    await client.insert(userTable).values(user);
    userId = user.id;
    const [category] = await client
      .insert(todoCategory)
      .values(omit(TodoCategoryFixture.create({ userId, sortOrder: 0 }), ["id"]))
      .returning();
    if (category === undefined) {
      throw new Error("category fixture 누락");
    }
    categoryId = category.id;
    todoId = await createTodo();
  });
  afterEach(() => {
    recording = null;
    vi.useRealTimers();
  });
  afterAll(async () => {
    if (context) {
      await destroyE2eApp(context);
    } else {
      await database?.stop();
    }
  });

  async function createTodo() {
    const [created] = await client
      .insert(todo)
      .values(
        omit(
          TodoFixture.create({ userId, categoryId, completed: false, startDate: AT, sortOrder: 0 }),
          ["id"],
        ),
      )
      .returning({ id: todo.id });
    if (created === undefined) {
      throw new Error("todo fixture 누락");
    }
    return created.id;
  }

  async function readItems() {
    return client.query.todoItem.findMany({
      columns: { id: true, sortOrder: true },
      where: { todoId },
      orderBy: { sortOrder: "asc" },
    });
  }

  async function createItems(itemCount: number) {
    await client.insert(todoItem).values(
      Array.from({ length: itemCount }, (_, sortOrder) => ({
        todoId,
        title: `항목 ${sortOrder}`,
        sortOrder,
      })),
    );
    return readItems();
  }

  async function holdTodoRow() {
    const acquired = Promise.withResolvers<void>();
    const released = Promise.withResolvers<void>();
    const holding = client.transaction(async (transaction) => {
      await transaction.select({ id: todo.id }).from(todo).where(eq(todo.id, todoId)).for("update");
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

  async function waitForBlockedRequests(expected: number) {
    await vi.waitFor(
      async () => {
        const waiting = await client.execute<{ count: number }>(sql`
          SELECT count(*)::int AS count FROM pg_stat_activity
          WHERE datname=current_database() AND wait_event_type='Lock'
        `);
        expect(waiting.rows[0]?.count).toBe(expected);
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
    const items = await client.query.todoItem.findMany({
      columns: { sortOrder: true },
      where: { todoId },
    });

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
      await client.query.todo.findFirst({
        columns: { completed: true, completedAt: true },
        where: { id: todoId },
      }),
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
    if (first === undefined) {
      throw new Error("item fixture 누락");
    }
    const repository = context.module.get<TodoRepositoryPort>(TODO_REPOSITORY);
    const unitOfWork = context.module.get<UnitOfWorkPort>(UNIT_OF_WORK);

    // When
    const result = unitOfWork.run(() => repository.reorderItems([first.id, 999999]));

    // Then
    await expect(result).rejects.toBeInstanceOf(DatabaseRecordNotFoundError);
    expect(await readItems()).toEqual(items);
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
    const row = await client.query.todo.findFirst({
      columns: { title: true, completed: true, completedAt: true, endDate: true },
      where: { id: todoId },
    });
    expect(row).toEqual({ title: "기존 제목", completed: false, completedAt: null, endDate: null });
  });

  it("3개 item 재정렬은 PK 선행 조회 없이 한 번의 UPDATE로 수정하며 잠금 포함 4 SQL로 완료한다", async () => {
    // Given
    const items = await createItems(3);
    const itemIds = items.map((item) => item.id).reverse();
    const statements: string[] = [];
    recording = statements;

    // When
    const response = await context.module
      .get(ReorderTodoItems)
      .execute({ todoId, userId, itemIds });
    recording = null;

    // Then
    expect(response.items.map((item) => item.id)).toEqual(itemIds);
    expect(statementSummary(statements)).toEqual({ total: 4, orm: 3, locks: 1 });
    expect(
      statements.filter((statement) =>
        /^select (?:(?!\sfrom\s)[^])*\sfrom "TodoItem"/i.test(statement),
      ),
    ).toHaveLength(0);
    process.stdout.write(
      `PLANNING_QUERY_AFTER_RESULT ${JSON.stringify({ scenario: "reorder-3-items", ...statementSummary(statements), fixture: { items: 3 }, transactionControlsExcluded: true })}\n`,
    );
  });

  it("반복 부모 3개와 item 6개는 각 한 번의 bulk INSERT와 잠금 포함 7 SQL로 저장한다", async () => {
    // Given
    await client.delete(todo).where(eq(todo.id, todoId));
    const statements: string[] = [];
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
    expect(response.todos.map((created) => created.items.map((item) => item.title))).toEqual(
      Array.from({ length: 3 }, () => ["첫 항목", "둘째 항목"]),
    );
    expect(response.todos.map((created) => created.sortOrder)).toEqual([0, 1, 2]);
    expect(statementSummary(statements)).toEqual({ total: 7, orm: 6, locks: 1 });
    expect(
      statements.filter((statement) => /^insert into "TodoItem"/i.test(statement)),
    ).toHaveLength(1);
    process.stdout.write(
      `PLANNING_QUERY_AFTER_RESULT ${JSON.stringify({ scenario: "recurring-3-todos-2-items", ...statementSummary(statements), fixture: { parents: 3, itemsPerParent: 2 }, transactionControlsExcluded: true })}\n`,
    );
  });

  it("반복 item 저장이 실패하면 부모 bulk 생성도 rollback한다", async () => {
    // Given
    const repository = context.module.get<TodoRepositoryPort>(TODO_REPOSITORY);
    const unitOfWork = context.module.get<UnitOfWorkPort>(UNIT_OF_WORK);
    const before = await client.query.todo.findMany({ columns: { id: true }, where: { userId } });

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
    expect(await client.query.todo.findMany({ columns: { id: true }, where: { userId } })).toEqual(
      before,
    );
    expect(await client.query.todoItem.findMany({ columns: { id: true } })).toEqual([]);
  });
});
