import { convertMemoToTodosResponseSchema, todoSchema } from "@aido/api";
import sql from "sql-template-tag";
import request from "supertest";

import { sqlStatement } from "#api/platform/database/database-sql";
import { createTestClient, withDatabaseTransaction } from "#test/setup/database-context";
import { TestDatabase } from "#test/setup/test-database";

import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers/index.js";

const CONVERSION_TIME = new Date("2027-01-08T12:00:00.000Z");

describe("메모 변환 상태 HTTP 계약", () => {
  let context: E2eTestContext;

  beforeAll(async () => {
    const database = new TestDatabase({ createClient: (url) => createTestClient(url, { max: 6 }) });
    await database.start();
    context = await createE2eApp({ testDatabase: database });
  });
  afterAll(async () => {
    vi.useRealTimers();
    await destroyE2eApp(context);
  });
  beforeEach(async () => {
    await context.reset();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(CONVERSION_TIME);
  });
  afterEach(() => vi.useRealTimers());

  it("같은 메모를 동시에 변환하면 한 요청만 201로 성공하고 Todo는 하나만 생성한다", async () => {
    // Given
    const user = await context.helpers.createVerifiedUser("memo-concurrent@test.com", "Test1234!");
    const categoryId = await context.helpers.getDefaultCategoryId(user.accessToken);
    const created = await request(context.app.getHttpServer())
      .post("/v1/memos")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ content: "동시 변환 대상" })
      .expect(201);
    const memoId: number = created.body.data.memo.id;
    const client = context.testDatabase.getClient();
    const acquired = Promise.withResolvers<void>();
    const released = Promise.withResolvers<void>();
    const holding = withDatabaseTransaction(client, async (transaction) => {
      await transaction.query(
        sqlStatement(transaction, sql`SELECT "id" FROM "Memo" WHERE "id" = ${memoId} FOR UPDATE`)
          .returnsRow({ id: "pg/int4@1" })
          .build(),
      );
      acquired.resolve();
      await released.promise;
    });
    await Promise.race([
      acquired.promise,
      holding.then(() => {
        throw new Error("메모 잠금이 요청 전에 종료되었습니다.");
      }),
    ]);
    const convert = () =>
      request(context.app.getHttpServer())
        .post(`/v1/memos/${memoId}/convert-to-todo`)
        .set("Authorization", `Bearer ${user.accessToken}`)
        .send({ categoryId, startDate: "2027-01-09" })
        .then((response) => response);
    // When
    const pendingResponses = Promise.all([convert(), convert()]);
    try {
      await vi.waitFor(
        async () => {
          const waiting = await client
            .runtime()
            .query(
              client.raw
                .sql`SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND (query LIKE '%Memo%' OR query LIKE '%pg_advisory_xact_lock%')`
                .returnsRow({ count: "pg/int4@1" })
                .build(),
            );
          expect(waiting[0]?.count).toBe(2);
        },
        { timeout: 5000, interval: 10 },
      );
    } finally {
      released.resolve();
      await holding;
      await pendingResponses;
    }
    const responses = await pendingResponses;
    // Then
    expect(responses.map((response) => response.status).sort()).toEqual([201, 404]);
    const rejected = responses.find((response) => response.status === 404);
    expect(rejected?.body.error.code).toBe("MEMO_2001");
    const todos = await client.orm.public.Todo.where({ userId: user.userId })
      .select("id", "title")
      .all();
    expect(todos).toHaveLength(1);
    expect(todos[0]?.title).toBe("동시 변환 대상");
    expect(await client.orm.public.Memo.where({ id: memoId }).select("id").first()).toBeNull();
  });

  it("일괄 변환의 후속 카테고리 오류는 404를 반환하고 앞선 Todo와 원본 메모를 유지한다", async () => {
    // Given
    const user = await context.helpers.createVerifiedUser("memo-prefix@test.com", "Test1234!");
    const categoryId = await context.helpers.getDefaultCategoryId(user.accessToken);
    const created = await request(context.app.getHttpServer())
      .post("/v1/memos")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ content: "부분 변환 대상" })
      .expect(201);
    const memoId: number = created.body.data.memo.id;
    // When
    const response = await request(context.app.getHttpServer())
      .post(`/v1/memos/${memoId}/convert-to-todos`)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({
        todos: [
          { title: "성공한 첫 항목", categoryId, startDate: "2027-01-09" },
          { title: "잘못된 카테고리", categoryId: 999999, startDate: "2027-01-10" },
          { title: "실행하지 않을 항목", categoryId, startDate: "2027-01-11" },
        ],
      })
      .expect(404);
    // Then
    expect(response.body.error.code).toBe("TODO_CATEGORY_0851");
    const client = context.testDatabase.getClient();
    const todos = await client.orm.public.Todo.where({ userId: user.userId }).select("title").all();
    expect(todos.map((todo) => todo.title)).toEqual(["성공한 첫 항목"]);
    expect(await client.orm.public.Memo.where({ id: memoId }).select("content").first()).toEqual({
      content: "부분 변환 대상",
    });
  });

  it("단건과 반복 항목을 입력 순서로 반환하며 false·시간·하위 항목과 펼친 개수를 유지한다", async () => {
    // Given
    const user = await context.helpers.createVerifiedUser("memo-mixed@test.com", "Test1234!");
    const categoryId = await context.helpers.getDefaultCategoryId(user.accessToken);
    const created = await request(context.app.getHttpServer())
      .post("/v1/memos")
      .set("Authorization", `Bearer ${user.accessToken}`)
      .send({ content: "혼합 변환 대상" })
      .expect(201);
    const memoId: number = created.body.data.memo.id;
    // When
    const response = await request(context.app.getHttpServer())
      .post(`/v1/memos/${memoId}/convert-to-todos`)
      .set("Authorization", `Bearer ${user.accessToken}`)
      .set("X-Timezone", "Asia/Seoul")
      .send({
        todos: [
          {
            title: "단건",
            categoryId,
            startDate: "2027-01-09",
            scheduledTime: "11:15",
            isAllDay: false,
            visibility: "PRIVATE",
            items: [{ title: "단건 준비" }],
          },
          {
            title: "반복",
            categoryId,
            startDate: "2027-01-08",
            scheduledTime: "09:30",
            isAllDay: false,
            isRecurring: true,
            recurrence: { daysOfWeek: ["FRI", "MON"], endDate: "2027-01-11" },
            items: [{ title: "운동복" }, { title: "스트레칭" }],
          },
        ],
      })
      .expect(201);
    // Then
    const result = convertMemoToTodosResponseSchema.parse(response.body.data);
    expect(result.message).toBe("메모가 3개의 할 일로 변환되었습니다.");
    expect(result.todos.map((todo) => todo.title)).toEqual(["단건", "반복", "반복"]);
    expect(result.todos.map((todo) => todo.startDate)).toEqual([
      "2027-01-09",
      "2027-01-08",
      "2027-01-11",
    ]);
    expect(result.todos.map((todo) => todo.scheduledTime)).toEqual([
      "2027-01-09T02:15:00.000Z",
      "2027-01-08T00:30:00.000Z",
      "2027-01-11T00:30:00.000Z",
    ]);
    expect(result.todos.map((todo) => todo.isAllDay)).toEqual([false, false, false]);
    expect(result.todos.map((todo) => todo.visibility)).toEqual(["PRIVATE", "PUBLIC", "PUBLIC"]);
    expect(result.todos.map((todo) => todo.itemStats.total)).toEqual([1, 2, 2]);
    expect(result.todos.map((todo) => todo.items.map((item) => item.title))).toEqual([
      ["단건 준비"],
      ["운동복", "스트레칭"],
      ["운동복", "스트레칭"],
    ]);
    result.todos.forEach((todo) => expect(todoSchema.safeParse(todo).success).toBe(true));
    expect(
      await context.testDatabase
        .getClient()
        .orm.public.Memo.where({ id: memoId })
        .select("id")
        .first(),
    ).toBeNull();
  });
});
