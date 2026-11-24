import { createHash } from "node:crypto";

import { IDEMPOTENCY_KEY_HEADER, TODO_IMPORT_LIMITS, TODO_LIMITS } from "@aido/api/vocabulary";
import { and, eq, sql } from "drizzle-orm";
import request from "supertest";
import { vi } from "vitest";

import { MaterializeTodoImportUseCase } from "#api/modules/planning/todo-imports/application/use-cases/materialize-todo-import.use-case";
import { TODO_IMPORT_MATERIALIZATION_QUEUE } from "#api/modules/planning/todo-imports/infrastructure/jobs/todo-import-materialization.queue";
import { jobConfig } from "#api/platform/config/job.config";
import { DRIZZLE, type Database } from "#api/platform/database/database.client";
import { todo, todoImportLink } from "#api/platform/database/schema/index";
import { localDateIn } from "#api/shared/domain/time/timezone-name";
import {
  createE2eApp,
  destroyE2eApp,
  type E2eTestContext,
} from "#test/e2e/helpers/e2e-app-factory";
import { preparePgBossSchema, useRealJobQueue } from "#test/e2e/helpers/real-job-queue";
import { nowInstant } from "#test/fixtures/platform/clock.fixture";

const TIMEZONE = "Asia/Seoul";
const COLLECTION_KEY = hashedKey("calendar-big");
const ITEM_COUNT = 1050;
const WORKER_WAIT = { timeout: 60_000, interval: 500 } as const;

function hashedKey(seed: string): string {
  return createHash("sha256").update(seed).digest("hex");
}

// 실제 pg-boss worker가 round를 이어 가고, 같은 round가 다시 와도 할 일이 두 번 생기지 않는지 본다
describe("캘린더 가져오기 작업 (실제 pg-boss)", () => {
  let testContext: E2eTestContext;

  beforeAll(async () => {
    await preparePgBossSchema();
    testContext = await createE2eApp({ customizeBuilder: useRealJobQueue });
  }, 120_000);

  afterAll(async () => {
    await destroyE2eApp(testContext);
  });

  function http() {
    return request(testContext.app.getHttpServer());
  }

  function database(): Database {
    return testContext.module.get<Database>(DRIZZLE);
  }

  async function jobCount(queue: string): Promise<number> {
    const { schema } = jobConfig.parse(process.env);
    const result = await database().execute<{ count: number }>(
      sql`SELECT count(*)::int AS count FROM ${sql.identifier(schema)}.job WHERE name = ${queue}`,
    );
    return result.rows[0]?.count ?? 0;
  }

  it("1,000개 넘는 가져오기를 round 둘로 끝내고, 겹쳐 온 같은 round는 할 일을 더 만들지 않으며 알림을 예약한다", async () => {
    // Given
    const user = await testContext.helpers.createVerifiedUser(
      "import-worker@test.com",
      "Test1234!",
    );
    const auth = `Bearer ${user.accessToken}`;
    const categoryId = await testContext.helpers.getDefaultCategoryId(user.accessToken);
    const tomorrow = localDateIn(nowInstant(), TIMEZONE).add({ days: 1 });
    const started = await http()
      .post("/v1/todo-imports")
      .set("Authorization", auth)
      .set("X-Timezone", TIMEZONE)
      .set(IDEMPOTENCY_KEY_HEADER, "worker-import-1")
      .send({
        source: "DEVICE_CALENDAR",
        startDate: tomorrow.toString(),
        endDate: tomorrow.add({ days: 7 }).toString(),
        timeMode: "TIME",
        targets: [{ targetKey: "all", kind: "EXISTING_CATEGORY", categoryId }],
        collections: [{ collectionKey: COLLECTION_KEY, targetKey: "all", expectedItemCount: 1 }],
      })
      .expect(201);
    const importId: string = started.body.data.todoImport.id;
    for (let offset = 0; offset < ITEM_COUNT; offset += TODO_IMPORT_LIMITS.MAX_ITEMS_PER_CHUNK) {
      const items = Array.from(
        { length: Math.min(TODO_IMPORT_LIMITS.MAX_ITEMS_PER_CHUNK, ITEM_COUNT - offset) },
        (_, index) => ({
          sourceKey: hashedKey(`event-${offset + index}`),
          collectionKey: COLLECTION_KEY,
          title: `일정 ${offset + index}`,
          startDate: tomorrow.add({ days: (offset + index) % 7 }).toString(),
          endDate: null,
          localTime: "09:00",
        }),
      );
      await http()
        .post(`/v1/todo-imports/${importId}/items`)
        .set("Authorization", auth)
        .send({ items })
        .expect(200);
    }

    // When
    await http().post(`/v1/todo-imports/${importId}/commit`).set("Authorization", auth).expect(200);
    // 재전달(배포 중 두 프로세스·재시도)을 흉내 내 worker와 같은 round를 한 번 더 돌린다
    await testContext.module.get(MaterializeTodoImportUseCase).execute({ importId, round: 0 });

    // Then
    await vi.waitFor(async () => {
      const found = await http().get(`/v1/todo-imports/${importId}`).set("Authorization", auth);
      expect(found.body.data.todoImport.status).toBe("COMPLETED");
    }, WORKER_WAIT);
    const found = (await http().get(`/v1/todo-imports/${importId}`).set("Authorization", auth)).body
      .data.todoImport;
    const todoCount = await database().$count(
      todo,
      and(eq(todo.userId, user.userId), eq(todo.categoryId, categoryId)),
    );
    expect(found).toMatchObject({
      processedItemCount: ITEM_COUNT,
      counts: {
        created: TODO_LIMITS.MAX_PER_CATEGORY,
        skippedCapacity: ITEM_COUNT - TODO_LIMITS.MAX_PER_CATEGORY,
      },
    });
    expect(todoCount).toBe(TODO_LIMITS.MAX_PER_CATEGORY);
    expect(await database().$count(todoImportLink, eq(todoImportLink.importId, importId))).toBe(
      TODO_LIMITS.MAX_PER_CATEGORY,
    );
    expect(await jobCount(TODO_IMPORT_MATERIALIZATION_QUEUE.name)).toBe(2);
    expect(await jobCount("todo-reminder.v1")).toBeGreaterThan(0);
  }, 120_000);
});
