import { DrizzleSweepCursorAdapter } from "#api/platform/jobs/drizzle-sweep-cursor.adapter";
import { createDatabaseTransactionFixture } from "#test/setup/database-context";
import { TestDatabase } from "#test/setup/test-database";

describe("DrizzleSweepCursorAdapter (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let cursor: DrizzleSweepCursorAdapter;

  beforeAll(async () => {
    database = new TestDatabase();
    const client = await database.start();
    cursor = new DrizzleSweepCursorAdapter(createDatabaseTransactionFixture(client).txHost);
  });

  beforeEach(async () => {
    await database.cleanup();
  });

  afterAll(async () => {
    await database?.stop();
  });

  it("처음 보는 key는 null이고 저장한 시각을 ms 단위로 그대로 읽는다", async () => {
    // Given
    const at = Temporal.Instant.from("2026-11-10T07:30:00.123Z");
    const before = await cursor.findLastCompletedAt("tz-reminder-sweep");

    // When
    await cursor.markCompleted("tz-reminder-sweep", at);

    // Then
    expect(before).toBeNull();
    expect(await cursor.findLastCompletedAt("tz-reminder-sweep")).toEqual(at);
  });

  it("더 이른 시각으로는 되돌리지 않고 더 늦은 시각으로만 옮긴다", async () => {
    // Given
    const later = Temporal.Instant.from("2026-11-10T07:30:00Z");
    await cursor.markCompleted("tz-reminder-sweep", later);

    // When
    await cursor.markCompleted("tz-reminder-sweep", later.subtract({ minutes: 5 }));
    const afterEarlier = await cursor.findLastCompletedAt("tz-reminder-sweep");
    await cursor.markCompleted("tz-reminder-sweep", later.add({ minutes: 1 }));

    // Then
    expect(afterEarlier).toEqual(later);
    expect(await cursor.findLastCompletedAt("tz-reminder-sweep")).toEqual(
      later.add({ minutes: 1 }),
    );
  });
});
