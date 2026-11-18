import type { TodoRepeat } from "@aido/api/contracts/todo/v1";
import { asc, eq } from "drizzle-orm";
import { omit } from "es-toolkit";

import { DailyCompletionCachePort } from "#api/modules/insights/daily-completions/application/ports/daily-completion-cache.port";
import { TodoCategoryId } from "#api/modules/planning/todo-categories/domain/todo-category-id.vo";
import { UpdateFollowingTodosUseCase } from "#api/modules/planning/todo-series/application/use-cases/update-following-todos.use-case";
import { CreateTodoUseCase } from "#api/modules/planning/todos/application/use-cases/create-todo.use-case";
import { DeleteTodoUseCase } from "#api/modules/planning/todos/application/use-cases/delete-todo.use-case";
import {
  EditTodoUseCase,
  type EditTodoInput,
} from "#api/modules/planning/todos/application/use-cases/edit-todo.use-case";
import {
  todo,
  todoCategory,
  todoSeries,
  user as userTable,
} from "#api/platform/database/schema/index";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { createEntityId } from "#api/shared/domain/model/entity-id";
import { plainDateFromDate } from "#api/shared/domain/time/plain-date";
import { CountingDailyCompletionCache } from "#test/doubles/insights/counting-daily-completion-cache";
import { DateClock } from "#test/doubles/platform/date-clock";
import { TodoCategoryFixture, UserFixture } from "#test/fixtures/index";
import { createTestClient } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

import {
  createE2eApp,
  destroyE2eApp,
  type E2eTestContext,
} from "../../../e2e/helpers/e2e-app-factory.js";

const AT = new Date("2026-11-02T00:00:00.000Z");
const DAILY_NEVER: TodoRepeat = { frequency: "DAILY", end: { type: "NEVER" } };
const WEEKLY_MON: TodoRepeat = {
  frequency: "WEEKLY",
  interval: 1,
  weekdays: ["MON"],
  end: { type: "NEVER" },
};

// 범위 수정·삭제가 회차 행을 바꾸면 규칙 값이 그대로여도 일간 완료 캐시가 커밋 뒤 한 번 비워진다
describe("반복 회차 범위 수정·삭제 뒤 일간 완료 캐시 (실제 앱·PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;
  let context: E2eTestContext;
  let cache: CountingDailyCompletionCache;
  let userId: string;
  let categoryId: number;

  beforeAll(async () => {
    database = new TestDatabase({ createClient: (url) => createTestClient(url, { max: 4 }) });
    client = await database.start();
    context = await createE2eApp({
      testDatabase: database,
      customizeBuilder: (builder) =>
        builder
          .overrideProvider(ClockPort)
          .useValue(new DateClock())
          .overrideProvider(DailyCompletionCachePort)
          .useClass(CountingDailyCompletionCache),
    });
    const resolved = context.module.get(DailyCompletionCachePort);
    if (!(resolved instanceof CountingDailyCompletionCache)) {
      throw new Error("일간 완료 캐시를 세는 double로 바꾸지 못했습니다.");
    }
    cache = resolved;
  }, 60_000);

  beforeEach(async () => {
    await context.reset();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(AT);
    const user = UserFixture.create({
      id: createEntityId(),
      email: "series-cache@example.com",
      userTag: "SERCACH1",
    });
    await client.insert(userTable).values(user);
    userId = user.id;
    categoryId = await insertCategory(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  afterAll(async () => {
    await destroyE2eApp(context);
  });

  async function insertCategory(sortOrder: number): Promise<number> {
    const [category] = await client
      .insert(todoCategory)
      .values(omit(TodoCategoryFixture.create({ userId, sortOrder }), ["id"]))
      .returning();
    if (category == null) {
      throw new Error("카테고리 fixture 누락");
    }
    return category.id;
  }

  async function start() {
    const { series, todos } = await context.module.get(CreateTodoUseCase).execute({
      userId: UserId.reconstitute(userId),
      categoryId: TodoCategoryId.reconstitute(categoryId),
      title: "물 마시기",
      startDate: plainDateFromDate(AT),
      scheduledTime: null,
      timezone: "UTC",
      items: [],
      repeat: DAILY_NEVER,
    });
    if (series == null) {
      throw new Error("규칙 생성 실패");
    }
    cache.invalidatedUserIds.length = 0;
    return { seriesId: series.id, todoIds: todos.map(({ id }) => id) };
  }

  function edit(id: number, change: Omit<EditTodoInput, "id" | "userId" | "timezone">) {
    return context.module.get(EditTodoUseCase).execute({ id, userId, timezone: "UTC", ...change });
  }

  function deleteTodo(id: number, scope: "THIS_AND_FOLLOWING" | "ALL") {
    return context.module.get(DeleteTodoUseCase).execute({ id, userId, scope });
  }

  function rowsOf(seriesId: string) {
    return client
      .select()
      .from(todo)
      .where(eq(todo.seriesId, seriesId))
      .orderBy(asc(todo.occurrenceDate));
  }

  it("보낸 카테고리가 규칙과 같아도 따로 옮긴 회차를 되돌리면 캐시를 한 번 지운다", async () => {
    // Given
    const { seriesId, todoIds } = await start();
    const moved = todoIds[2] ?? 0;
    const otherCategoryId = await insertCategory(1);
    await client.update(todo).set({ categoryId: otherCategoryId }).where(eq(todo.id, moved));

    // When
    await edit(todoIds[1] ?? 0, { scope: "THIS_AND_FOLLOWING", data: { categoryId } });

    // Then
    const rows = await rowsOf(seriesId);
    expect(rows.find((row) => row.id === moved)?.categoryId).toBe(categoryId);
    expect(cache.invalidatedUserIds).toEqual([userId]);
  });

  it("끝낸 반복의 첫 회차에서 이후 삭제로 규칙 값이 그대로여도 회차를 지우면 캐시를 한 번 지운다", async () => {
    // Given
    const { seriesId, todoIds } = await start();
    const first = todoIds[0] ?? 0;
    await edit(first, { repeat: null, data: {} });
    cache.invalidatedUserIds.length = 0;

    // When
    await deleteTodo(first, "THIS_AND_FOLLOWING");

    // Then
    expect(await rowsOf(seriesId)).toEqual([]);
    expect(cache.invalidatedUserIds).toEqual([userId]);
  });

  it("규칙 행이 없는 묶음을 모두 지우면 캐시를 한 번 지운다", async () => {
    // Given
    const { seriesId, todoIds } = await start();
    await client.delete(todoSeries).where(eq(todoSeries.id, seriesId));

    // When
    await deleteTodo(todoIds[0] ?? 0, "ALL");

    // Then
    expect(await rowsOf(seriesId)).toEqual([]);
    expect(cache.invalidatedUserIds).toEqual([userId]);
  });

  it("나뉜 반복을 한 번에 고쳐 구간마다 사실이 나도 캐시는 사용자마다 한 번만 지운다", async () => {
    // Given
    const { todoIds } = await start();
    const updateFollowing = context.module.get(UpdateFollowingTodosUseCase);
    await updateFollowing.execute({
      id: todoIds[3] ?? 0,
      userId,
      timezone: "UTC",
      repeat: WEEKLY_MON,
    });
    cache.invalidatedUserIds.length = 0;

    // When
    await updateFollowing.execute({
      id: todoIds[0] ?? 0,
      userId,
      timezone: "UTC",
      title: "물 두 잔 마시기",
      visibility: "PRIVATE",
    });

    // Then
    expect(cache.invalidatedUserIds).toEqual([userId]);
  });
});
