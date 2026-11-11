import { eq, sql } from "drizzle-orm";
import { pgTable, serial } from "drizzle-orm/pg-core";

import { instant, plainDate } from "#api/platform/database/columns/temporal-columns";
import { nextSequenceValue, nextSequenceValues } from "#api/platform/database/sequence";
import { createTestClient } from "#test/setup/database-context";
import { TestDatabase, type TestDatabaseClient } from "#test/setup/test-database";

const kernelSample = pgTable("KernelSample", {
  id: serial().primaryKey(),
  occurredAt: instant().notNull(),
  confirmedAt: instant({ withTimezone: true }).notNull(),
  dueDate: plainDate().notNull(),
});

const PROCESS_TIME_ZONES = ["Asia/Seoul", "America/Los_Angeles"];

describe("DB 커널 — Temporal column·sequence (실제 PostgreSQL)", () => {
  let database: TestDatabase;
  let client: TestDatabaseClient;

  beforeAll(async () => {
    // 임시 테이블은 세션마다 따로라 연결 하나만 쓴다
    database = new TestDatabase({ createClient: (uri) => createTestClient(uri, { max: 1 }) });
    client = await database.start();
    await client.execute(sql`
      CREATE TEMP TABLE "KernelSample" (
        "id" serial PRIMARY KEY,
        "occurredAt" timestamp(3) NOT NULL,
        "confirmedAt" timestamp(3) with time zone NOT NULL,
        "dueDate" date NOT NULL
      )
    `);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  afterAll(async () => {
    await database.stop();
  });

  it.each(PROCESS_TIME_ZONES)(
    "%s 프로세스에서도 순간과 날짜를 그대로 저장하고 읽는다",
    async (timeZone) => {
      // Given
      vi.stubEnv("TZ", timeZone);
      const occurredAt = Temporal.Instant.from("2026-11-10T14:59:59.007Z");
      const confirmedAt = Temporal.Instant.from("2026-03-08T10:30:00.123Z");
      const dueDate = Temporal.PlainDate.from("2026-11-10");

      // When
      const [inserted] = await client
        .insert(kernelSample)
        .values({ occurredAt, confirmedAt, dueDate })
        .returning({ id: kernelSample.id });
      const [row] = await client
        .select()
        .from(kernelSample)
        .where(eq(kernelSample.id, inserted?.id ?? -1));

      // Then
      expect(row?.occurredAt.equals(occurredAt)).toBe(true);
      expect(row?.confirmedAt.equals(confirmedAt)).toBe(true);
      expect(row?.dueDate.equals(dueDate)).toBe(true);
    },
  );

  it("마이크로초가 있는 순간은 ms까지만 저장한다", async () => {
    // Given
    const occurredAt = Temporal.Instant.from("2026-11-10T00:00:00.123456Z");

    // When
    const [row] = await client
      .insert(kernelSample)
      .values({
        occurredAt,
        confirmedAt: occurredAt,
        dueDate: Temporal.PlainDate.from("2026-11-10"),
      })
      .returning();

    // Then
    const expected = Temporal.Instant.from("2026-11-10T00:00:00.123Z");
    expect(row?.occurredAt.equals(expected)).toBe(true);
    expect(row?.confirmedAt.equals(expected)).toBe(true);
  });

  it("serial 시퀀스에서 한 문장으로 연속한 id 3개를 받는다", async () => {
    // Given
    const first = await nextSequenceValue(client, kernelSample.id);

    // When
    const values = await client.transaction((tx) => nextSequenceValues(tx, kernelSample.id, 3));

    // Then
    expect(values).toEqual([first + 1, first + 2, first + 3]);
  });
});
