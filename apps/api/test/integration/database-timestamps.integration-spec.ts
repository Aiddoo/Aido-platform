import { omit } from "es-toolkit";

import { decodeRecord, encodeCreate, encodePatch } from "#api/platform/database/database-records";
import { TodoCategoryFixture, TodoFixture, UserFixture } from "#test/fixtures/index";
import { createTestClient, withDatabaseTransaction } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

const AT = new Date("2027-01-04T12:00:00.123Z");
const TIMEZONES = ["UTC", "Asia/Seoul", "America/Los_Angeles"];

describe("Prisma 자동 timestamp의 UTC 계약 (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;
  let userId: string;
  let categoryId: number;
  let todoId: number;

  beforeAll(async () => {
    database = new TestDatabase();
    client = await database.start();
  });

  beforeEach(async () => {
    await database.cleanup();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(AT);
    const user = UserFixture.create();
    await client.orm.public.User.create(encodeCreate("User", user));
    userId = user.id;
    const category = await client.orm.public.TodoCategory.create(
      encodeCreate("TodoCategory", TodoCategoryFixture.create({ userId })),
    );
    categoryId = category.id;
    const todo = await client.orm.public.Todo.create(
      encodeCreate("Todo", omit(TodoFixture.create({ userId, categoryId }), ["id"])),
    );
    todoId = todo.id;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  afterAll(async () => {
    await database.stop();
  });

  async function savedUpdatedAt() {
    const row = decodeRecord(
      "Todo",
      await client.orm.public.Todo.where({ id: todoId }).select("updatedAt").first(),
    );
    return row?.updatedAt;
  }

  it.each(TIMEZONES)(
    "%s 프로세스의 단건 수정은 자동 updatedAt의 UTC 시각을 유지한다",
    async (timezone) => {
      // Given
      vi.stubEnv("TZ", timezone);
      // When
      await client.orm.public.Todo.where({ id: todoId }).update(
        encodePatch("Todo", { title: "단건 수정" }),
      );
      // Then
      expect(await savedUpdatedAt()).toEqual(AT);
    },
  );

  it.each(TIMEZONES)(
    "%s 트랜잭션의 updateAndCount도 자동 UTC 시각을 유지한다",
    async (timezone) => {
      // Given
      vi.stubEnv("TZ", timezone);
      // When
      const affected = await withDatabaseTransaction(client, (transaction) =>
        transaction.orm.public.Todo.where({ id: todoId }).updateAndCount(
          encodePatch("Todo", { title: "트랜잭션 수정" }),
        ),
      );
      // Then
      expect(affected).toBe(1);
      expect(await savedUpdatedAt()).toEqual(AT);
    },
  );

  it("일괄 생성과 수정의 모든 행에 동일한 자동 UTC 시각을 저장한다", async () => {
    // Given
    vi.stubEnv("TZ", "Asia/Seoul");
    const items = [1, 2].map((sortOrder) =>
      encodeCreate(
        "Todo",
        omit(TodoFixture.create({ userId, categoryId, sortOrder }), ["id", "updatedAt"]),
      ),
    );
    // When
    const created = decodeRecord("Todo", await client.orm.public.Todo.createAll(items));
    const nextAt = new Date("2027-01-04T12:30:00.456Z");
    vi.setSystemTime(nextAt);
    const updated = decodeRecord(
      "Todo",
      await client.orm.public.Todo.where((row) => row.id.in(created.map((todo) => todo.id)))
        .select("updatedAt")
        .updateAll(encodePatch("Todo", { title: "일괄 수정" })),
    );
    // Then
    expect(created.map((todo) => todo.updatedAt)).toEqual([AT, AT]);
    expect(updated.map((todo) => todo.updatedAt)).toEqual([nextAt, nextAt]);
  });

  it("명시적 timestamp와 DATE·timestamptz·null은 기존 저장 계약을 유지한다", async () => {
    // Given
    vi.stubEnv("TZ", "America/Los_Angeles");
    const explicitUpdatedAt = new Date("2026-12-31T23:59:59.789Z");
    const startDate = new Date("2027-01-05T00:00:00.000Z");
    const scheduledTime = new Date("2027-01-05T09:30:00.456+09:00");
    // When
    await client.orm.public.Todo.where({ id: todoId }).updateAndCount(
      encodePatch("Todo", {
        updatedAt: explicitUpdatedAt,
        startDate,
        scheduledTime,
        completedAt: null,
      }),
    );
    const row = decodeRecord(
      "Todo",
      await client.orm.public.Todo.where({ id: todoId })
        .select("updatedAt", "startDate", "scheduledTime", "completedAt")
        .first(),
    );
    // Then
    expect(row).toEqual({
      updatedAt: explicitUpdatedAt,
      startDate,
      scheduledTime,
      completedAt: null,
    });
  });

  it("별도 연결을 소유하는 공용 테스트 클라이언트도 자동 UTC 시각을 유지한다", async () => {
    // Given
    vi.stubEnv("TZ", "Asia/Seoul");
    const independentClient = createTestClient(database.getConnectionUri(), { max: 1 });
    // When
    try {
      await independentClient.orm.public.Todo.where({ id: todoId }).updateAndCount(
        encodePatch("Todo", { title: "별도 연결 수정" }),
      );
      // Then
      expect(await savedUpdatedAt()).toEqual(AT);
    } finally {
      await independentClient.close();
    }
  });
});
