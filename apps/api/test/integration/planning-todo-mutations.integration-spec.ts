import type { TodoRepeat } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";
import { TODO_SERIES_LIMITS } from "@aido/api/vocabulary";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { eq, sql } from "drizzle-orm";
import { omit } from "es-toolkit";

import { DAILY_COMPLETION_CACHE_SUBSCRIPTIONS } from "#api/modules/insights/daily-completions/infrastructure/event-handlers/daily-completion-cache.event-handler";
import { DeleteTodoCategoryUseCase } from "#api/modules/planning/categories/application/use-cases/delete-todo-category.use-case";
import { TodoId } from "#api/modules/planning/shared/domain/todo-id.vo";
import { StagedTodoCreatorPort } from "#api/modules/planning/todos/application/ports/staged-todo-creator.port";
import { TodoRepositoryPort } from "#api/modules/planning/todos/application/ports/todo.repository.port";
import { AddTodoItemUseCase } from "#api/modules/planning/todos/application/use-cases/add-todo-item.use-case";
import { CreateTodoUseCase } from "#api/modules/planning/todos/application/use-cases/create-todo.use-case";
import { ReorderTodoItemsUseCase } from "#api/modules/planning/todos/application/use-cases/reorder-todo-items.use-case";
import { SetTodoCompletedUseCase } from "#api/modules/planning/todos/application/use-cases/set-todo-completed.use-case";
import { DatabaseRecordNotFoundError } from "#api/platform/database/database-error.util";
import { createEntityId } from "#api/platform/database/entity-id";
import {
  todo,
  todoCategory,
  todoItem,
  todoSeries,
  user as userTable,
} from "#api/platform/database/schema/index";
import {
  AFTER_COMMIT_TASK_REGISTRY,
  DOMAIN_EVENT_PUBLISHER,
  UNIT_OF_WORK,
  type AfterCommitTaskRegistryPort,
  type DomainEventPublisherPort,
  type UnitOfWorkPort,
} from "#api/shared/application/ports/index";
import { instantFromDate } from "#api/shared/domain/time/instant";
import { plainDateFromDate } from "#api/shared/domain/time/plain-date";
import { nowInstant } from "#test/fixtures/clock.fixture";
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
          TodoFixture.create({
            userId,
            categoryId,
            completed: false,
            startDate: plainDateFromDate(AT),
            sortOrder: 0,
          }),
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
        updatedAt: nowInstant(),
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
      { timeout: 5_000, interval: 10 },
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
    const add = context.module.get(AddTodoItemUseCase);

    // When
    const outcomes = await contend(
      () => add.execute({ todoId, userId, title: "첫 요청", timezone: "UTC" }),
      () => add.execute({ todoId, userId, title: "두 번째 요청", timezone: "UTC" }),
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
    const publish = vi.spyOn(publisher, "publish");
    const toggle = context.module.get(SetTodoCompletedUseCase);

    // When
    const outcomes = await contend(
      () =>
        toggle.execute({
          id: todoId,
          userId,
          completed: true,
          timezone: "Asia/Seoul",
        }),
      () =>
        toggle.execute({
          id: todoId,
          userId,
          completed: true,
          timezone: "Asia/Seoul",
        }),
    );

    // Then
    expect(outcomes.every((outcome) => outcome.status === "fulfilled")).toBe(true);
    expect(
      publish.mock.calls
        .flatMap(([events]) => events)
        .filter((event) => event.eventName === "planning.todo.completed"),
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
    const add = context.module.get(AddTodoItemUseCase);
    const release = await holdTodoRow();
    const blocked = add.execute({ todoId, userId, title: "대기 중", timezone: "UTC" });

    // When
    try {
      await waitForBlockedRequests(1);
      const response = await add.execute({
        todoId: otherTodoId,
        userId,
        title: "독립 요청",
        timezone: "UTC",
      });

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
    const repository = context.module.get(TodoRepositoryPort);
    const unitOfWork = context.module.get<UnitOfWorkPort>(UNIT_OF_WORK);

    // When
    const result = unitOfWork.run(() => repository.reorderItems([first.id, 999_999]));

    // Then
    await expect(result).rejects.toBeInstanceOf(DatabaseRecordNotFoundError);
    expect(await readItems()).toEqual(items);
  });

  it("부분 수정은 명시적 null·false를 저장하고 undefined는 이전 값을 유지한다", async () => {
    // Given
    const repository = context.module.get(TodoRepositoryPort);
    const unitOfWork = context.module.get<UnitOfWorkPort>(UNIT_OF_WORK);
    await unitOfWork.run(() =>
      repository.updateDetails(todoId, {
        title: "기존 제목",
        completed: true,
        completedAt: instantFromDate(AT),
        endDate: Temporal.PlainDate.from("2027-01-05"),
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
      .get(ReorderTodoItemsUseCase)
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
    const response = await context.module.get(CreateTodoUseCase).execute({
      userId,
      categoryId,
      title: "반복 생성",
      startDate: new Date("2027-01-04"),
      scheduledTime: null,
      timezone: "Asia/Seoul",
      isAllDay: true,
      visibility: "PUBLIC",
      items: [{ title: "첫 항목" }, { title: "둘째 항목" }],
      repeat: { frequency: "DAILY", end: { type: "COUNT", count: 3 } },
    });
    recording = null;

    // Then
    expect(response.todos).toHaveLength(3);
    expect(response.todos.map((created) => created.items.map((item) => item.title))).toEqual(
      Array.from({ length: 3 }, () => ["첫 항목", "둘째 항목"]),
    );
    expect(response.todos.map((created) => created.sortOrder)).toEqual([0, 1, 2]);
    expect(statements.filter((statement) => /^insert into "Todo"/i.test(statement))).toHaveLength(
      1,
    );
    expect(
      statements.filter((statement) => /^insert into "TodoItem"/i.test(statement)),
    ).toHaveLength(1);
  });

  it("규칙 하나로 체크리스트 포함 90일 회차를 Todo·TodoItem INSERT 한 번씩으로 만든다", async () => {
    // Given
    const statements: string[] = [];
    recording = statements;
    // When
    const response = await context.module.get(CreateTodoUseCase).execute({
      userId,
      categoryId,
      title: "매일 반복",
      startDate: AT,
      timezone: "UTC",
      items: [{ title: "항목" }],
      repeat: { frequency: "DAILY", end: { type: "NEVER" } },
    });
    recording = null;
    // Then
    expect(response.todos).toHaveLength(TODO_SERIES_LIMITS.VISIBLE_AHEAD_DAYS + 1);
    expect(statements.filter((statement) => /^insert into "Todo"/i.test(statement))).toHaveLength(
      1,
    );
    expect(
      statements.filter((statement) => /^insert into "TodoItem"/i.test(statement)),
    ).toHaveLength(1);
    expect(await client.$count(todoSeries, eq(todoSeries.userId, userId))).toBe(1);
  });

  describe("카테고리와 규칙", () => {
    async function createCategory(name: string) {
      const [category] = await client
        .insert(todoCategory)
        .values({
          userId,
          name,
          color: "#123456",
          updatedAt: Temporal.Instant.fromEpochMilliseconds(Date.now()),
          sortOrder: 1,
        })
        .returning();
      if (category === undefined) {
        throw new Error("category fixture 누락");
      }
      return category.id;
    }

    function startSeries(target: number, repeat: TodoRepeat) {
      return context.module.get(CreateTodoUseCase).execute({
        userId,
        categoryId: target,
        title: "카테고리 반복",
        startDate: AT,
        timezone: "UTC",
        repeat,
      });
    }

    it("카테고리를 지우며 옮기면 회차와 진행 중 규칙을 함께 옮긴다", async () => {
      // Given
      const source = await createCategory("지울 카테고리");
      const { series } = await startSeries(source, { frequency: "DAILY", end: { type: "NEVER" } });
      // When
      await context.module
        .get(DeleteTodoCategoryUseCase)
        .execute({ userId, categoryId: source, moveToCategoryId: categoryId });
      // Then
      const moved = await client.query.todoSeries.findFirst({ where: { id: series?.id } });
      expect(moved?.categoryId).toBe(categoryId);
      expect(await client.$count(todo, eq(todo.categoryId, source))).toBe(0);
    });

    it("진행 중 규칙이 있으면 할 일이 없어도 옮길 곳을 묻는다", async () => {
      // Given
      const source = await createCategory("규칙만 있는 카테고리");
      await startSeries(source, { frequency: "DAILY", end: { type: "NEVER" } });
      await client.delete(todo).where(eq(todo.categoryId, source));
      // When
      const outcome = context.module
        .get(DeleteTodoCategoryUseCase)
        .execute({ userId, categoryId: source });
      // Then
      await expect(outcome).rejects.toMatchObject({ errorCode: ErrorCode.TODO_CATEGORY_0855 });
    });

    it("끝난 규칙만 남은 카테고리는 묻지 않고 지운다", async () => {
      // Given
      const source = await createCategory("끝난 규칙 카테고리");
      const { series } = await startSeries(source, {
        frequency: "DAILY",
        end: { type: "COUNT", count: 1 },
      });
      await client.delete(todo).where(eq(todo.categoryId, source));
      // When
      await context.module.get(DeleteTodoCategoryUseCase).execute({ userId, categoryId: source });
      // Then
      expect(
        await client.query.todoSeries.findFirst({ where: { id: series?.id } }),
      ).toBeUndefined();
    });

    it("미래 회차는 한도에 세지 않고 진행 중 규칙 하나로 센다", async () => {
      // Given
      await startSeries(categoryId, { frequency: "DAILY", end: { type: "NEVER" } });
      // When
      const usage = await context.module
        .get(TodoRepositoryPort)
        .countCategoryUsage(userId, categoryId);
      // Then
      expect(usage).toBe(2);
    });
  });

  describe("커밋 후 생성 포트", () => {
    // 커밋 뒤 in-process 전달은 구독 이름 채널로 가므로 그 채널에 도착한 것만 커밋된 이벤트다
    function recordCommittedOccurrencesCreated(): { readonly delivered: unknown[] } {
      const channel = DAILY_COMPLETION_CACHE_SUBSCRIPTIONS.find(
        ({ eventName }) => eventName === "planning.todo-series.occurrences-created",
      )?.name;
      if (channel == null) {
        throw new Error("회차 생성 구독이 없습니다.");
      }
      const delivered: unknown[] = [];
      const emitter = context.module.get(EventEmitter2);
      const listener = (payload: unknown) => {
        delivered.push(payload);
      };
      emitter.on(channel, listener);
      onTestFinished(() => {
        emitter.off(channel, listener);
      });
      return { delivered };
    }

    function stageInsideUnitOfWork(afterStage: () => Promise<void>) {
      const creator = context.module.get<StagedTodoCreatorPort>(StagedTodoCreatorPort);
      const unitOfWork = context.module.get<UnitOfWorkPort>(UNIT_OF_WORK);
      const registry = context.module.get<AfterCommitTaskRegistryPort>(AFTER_COMMIT_TASK_REGISTRY);
      return unitOfWork.run(async () => {
        const staged = await creator.stage({
          userId,
          categoryId,
          title: "포트 반복",
          startDate: new Date("2027-01-04"),
          scheduledTime: "09:00",
          timezone: "Asia/Seoul",
          repeat: { frequency: "DAILY", end: { type: "UNTIL", date: "2027-01-05" } },
        });
        registry.register(staged.afterCommit);
        await afterStage();
        return staged;
      });
    }

    it("바깥 트랜잭션이 롤백되면 할 일도 생성 이벤트도 남지 않는다", async () => {
      // Given
      const { delivered } = recordCommittedOccurrencesCreated();
      const failure = new Error("바깥 작업 실패");
      // When
      const outcome = stageInsideUnitOfWork(() => Promise.reject(failure));
      // Then
      await expect(outcome).rejects.toBe(failure);
      expect(delivered).toEqual([]);
      expect(await client.$count(todo, eq(todo.title, "포트 반복"))).toBe(0);
    });

    it("커밋에 성공하면 그 뒤에 규칙당 생성 이벤트 하나를 낸다", async () => {
      // Given
      const { delivered } = recordCommittedOccurrencesCreated();
      // When
      const staged = await stageInsideUnitOfWork(async () => {
        expect(delivered).toEqual([]);
      });
      // Then
      expect(staged.todos).toHaveLength(2);
      expect(delivered).toEqual([expect.objectContaining({ userId })]);
      expect(staged.todos.every((created) => !created.isAllDay)).toBe(true);
    });
  });

  it("반복 item 저장이 실패하면 부모 bulk 생성도 rollback한다", async () => {
    // Given
    const repository = context.module.get(TodoRepositoryPort);
    const unitOfWork = context.module.get<UnitOfWorkPort>(UNIT_OF_WORK);
    const before = await client.query.todo.findMany({ columns: { id: true }, where: { userId } });

    // When
    const result = unitOfWork.run(async () =>
      repository.insertOccurrences(
        [
          {
            id: (await repository.nextIds(1))[0] ?? TodoId.reconstitute(0),
            userId,
            categoryId,
            title: "rollback 대상",
            startDate: plainDateFromDate(AT),
            endDate: null,
            scheduledLocalTime: null,
            scheduledTime: null,
            sortOrder: 1,
            isAllDay: true,
            visibility: "PUBLIC",
            occurrenceDate: "2027-01-04",
            createdAt: instantFromDate(AT),
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
