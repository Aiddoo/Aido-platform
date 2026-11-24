import { createHash } from "node:crypto";

import {
  activeTodoImportResponseSchema,
  receiveTodoImportItemsResponseSchema,
  todoImportResponseSchema,
} from "@aido/api/contracts/todo-import/v1";
import { IDEMPOTENCY_KEY_HEADER, PLAN_CATALOG, TODO_IMPORT_LIMITS } from "@aido/api/vocabulary";
import request from "supertest";

import { TODO_IMPORT_MATERIALIZATION_QUEUE } from "#api/modules/planning/todo-imports/infrastructure/jobs/todo-import-materialization.queue";
import { JobQueuePort } from "#api/shared/application/ports/job-queue.port";
import { localDateIn } from "#api/shared/domain/time/timezone-name";
import type { InMemoryJobQueue } from "#test/doubles/platform/in-memory-job-queue";
import {
  createE2eApp,
  destroyE2eApp,
  type E2eTestContext,
} from "#test/e2e/helpers/e2e-app-factory";
import { nowInstant } from "#test/fixtures/platform/clock.fixture";

const TIMEZONE = "Asia/Seoul";
const PASSWORD = "Test1234!";
const COLLECTION_KEY = hashedKey("calendar-work");

function hashedKey(seed: string): string {
  return createHash("sha256").update(seed).digest("hex");
}

function today(): Temporal.PlainDate {
  return localDateIn(nowInstant(), TIMEZONE);
}

interface StartOptions {
  readonly idempotencyKey?: string;
  readonly days?: number;
  readonly targets?: readonly object[];
  readonly expectedItemCount?: number;
  readonly visibility?: string;
}

describe("캘린더 가져오기 E2E", () => {
  let testContext: E2eTestContext;

  beforeAll(async () => {
    testContext = await createE2eApp();
  }, 60_000);

  afterAll(async () => {
    await destroyE2eApp(testContext);
  });

  beforeEach(async () => {
    await testContext.reset();
  });

  function http() {
    return request(testContext.app.getHttpServer());
  }

  function jobQueue(): InMemoryJobQueue {
    return testContext.module.get<typeof JobQueuePort, InMemoryJobQueue>(JobQueuePort);
  }

  async function userWithCategory(email: string) {
    const user = await testContext.helpers.createVerifiedUser(email, PASSWORD);
    const categoryId = await testContext.helpers.getDefaultCategoryId(user.accessToken);
    return { accessToken: user.accessToken, categoryId };
  }

  function start(accessToken: string, categoryId: number, options: StartOptions = {}) {
    const startDate = today();
    return http()
      .post("/v1/todo-imports")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("X-Timezone", TIMEZONE)
      .set(IDEMPOTENCY_KEY_HEADER, options.idempotencyKey ?? "import-start-1")
      .send({
        source: "DEVICE_CALENDAR",
        startDate: startDate.toString(),
        endDate: startDate.add({ days: (options.days ?? 30) - 1 }).toString(),
        timeMode: "TIME",
        visibility: options.visibility ?? "PRIVATE",
        targets: options.targets ?? [{ targetKey: "work", kind: "EXISTING_CATEGORY", categoryId }],
        collections: [
          {
            collectionKey: COLLECTION_KEY,
            targetKey: "work",
            expectedItemCount: options.expectedItemCount ?? 3,
          },
        ],
      });
  }

  function itemsOf(seeds: readonly string[], dayOffset = 0) {
    return seeds.map((seed, index) => ({
      sourceKey: hashedKey(seed),
      collectionKey: COLLECTION_KEY,
      title: `일정 ${seed}`,
      startDate: today().add({ days: dayOffset }).toString(),
      endDate: null,
      localTime: `0${index % 10}:00`,
    }));
  }

  function upload(accessToken: string, importId: string, items: readonly object[]) {
    return http()
      .post(`/v1/todo-imports/${importId}/items`)
      .set("Authorization", `Bearer ${accessToken}`)
      .send({ items });
  }

  function commit(accessToken: string, importId: string) {
    return http()
      .post(`/v1/todo-imports/${importId}/commit`)
      .set("Authorization", `Bearer ${accessToken}`);
  }

  it("시작 → 올리기 → 확정하면 시간대를 돌려주고 round 0 작업을 하나 넣는다", async () => {
    // Given
    const { accessToken, categoryId } = await userWithCategory("import-flow@test.com");
    const started = todoImportResponseSchema.parse(
      (await start(accessToken, categoryId).expect(201)).body.data,
    );
    const importId = started.todoImport.id;

    // When
    const first = await upload(accessToken, importId, itemsOf(["a", "b"])).expect(200);
    const resent = await upload(accessToken, importId, itemsOf(["a", "b", "c"])).expect(200);
    const committed = await commit(accessToken, importId).expect(200);
    const active = await http()
      .get("/v1/todo-imports/active")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    // Then
    expect(started.todoImport).toMatchObject({ status: "UPLOADING", timezone: TIMEZONE });
    expect(receiveTodoImportItemsResponseSchema.parse(first.body.data)).toEqual({
      acceptedCount: 2,
      receivedItemCount: 2,
    });
    expect(resent.body.data).toEqual({ acceptedCount: 1, receivedItemCount: 3 });
    expect(todoImportResponseSchema.parse(committed.body.data).todoImport.status).toBe("QUEUED");
    expect(activeTodoImportResponseSchema.parse(active.body.data).todoImport?.id).toBe(importId);
    expect(
      jobQueue()
        .jobsIn(TODO_IMPORT_MATERIALIZATION_QUEUE)
        .map((job) => job.payload),
    ).toEqual([{ importId, round: 0 }]);
  });

  it("같은 키로 같은 시작은 처음 가져오기, 다른 본문은 2307, 다른 키로 새로 시작하면 2301이다", async () => {
    // Given
    const { accessToken, categoryId } = await userWithCategory("import-retry@test.com");
    const first = await start(accessToken, categoryId).expect(201);

    // When
    const replayed = await start(accessToken, categoryId).expect(201);
    const mismatch = await start(accessToken, categoryId, { visibility: "PUBLIC" }).expect(422);
    const second = await start(accessToken, categoryId, {
      idempotencyKey: "import-start-2",
    }).expect(409);

    // Then
    expect(replayed.body.data.todoImport.id).toBe(first.body.data.todoImport.id);
    expect(mismatch.body.error.code).toBe("TODO_IMPORT_2307");
    expect(second.body.error).toMatchObject({
      code: "TODO_IMPORT_2301",
      details: { importId: first.body.data.todoImport.id },
    });
  });

  it("무료가 30일을 넘기면 2302(featureQuota), 남의 카테고리는 2303이다", async () => {
    // Given
    const { accessToken, categoryId } = await userWithCategory("import-reject@test.com");

    // When
    const beyond = await start(accessToken, categoryId, { days: 31 }).expect(403);
    const missing = await start(accessToken, categoryId, {
      idempotencyKey: "import-start-missing",
      targets: [{ targetKey: "work", kind: "EXISTING_CATEGORY", categoryId: categoryId + 100_000 }],
    }).expect(409);

    // Then
    expect(beyond.body.error).toMatchObject({
      code: "TODO_IMPORT_2302",
      details: {
        charged: false,
        featureQuota: { feature: "CALENDAR_IMPORT", limit: PLAN_CATALOG.CALENDAR_IMPORT.free },
      },
    });
    expect(missing.body.error).toMatchObject({
      code: "TODO_IMPORT_2303",
      details: { targets: [{ targetKey: "work", reason: "CATEGORY_NOT_FOUND" }] },
    });
  });

  it("기간 밖 일정은 2306, 3,000개를 넘기면 2309, 남의 가져오기는 2304, 확정 뒤 올리기는 2305다", async () => {
    // Given
    const { accessToken, categoryId } = await userWithCategory("import-items@test.com");
    const other = await userWithCategory("import-items-other@test.com");
    const importId = (await start(accessToken, categoryId).expect(201)).body.data.todoImport.id;

    // When
    const outside = await upload(accessToken, importId, itemsOf(["late"], 30)).expect(400);
    const chunks = Array.from(
      { length: TODO_IMPORT_LIMITS.MAX_ITEMS_PER_IMPORT / TODO_IMPORT_LIMITS.MAX_ITEMS_PER_CHUNK },
      (_, chunk) =>
        itemsOf(
          Array.from(
            { length: TODO_IMPORT_LIMITS.MAX_ITEMS_PER_CHUNK },
            (__, index) => `${chunk}-${index}`,
          ),
        ),
    );
    for (const chunk of chunks) {
      await upload(accessToken, importId, chunk).expect(200);
    }
    const overflow = await upload(accessToken, importId, itemsOf(["one-more"])).expect(422);
    const foreign = await upload(other.accessToken, importId, itemsOf(["x"])).expect(404);
    await commit(accessToken, importId).expect(200);
    const afterCommit = await upload(accessToken, importId, itemsOf(["y"])).expect(409);

    // Then
    expect(outside.body.error).toMatchObject({
      code: "TODO_IMPORT_2306",
      details: { reason: "ITEM_OUTSIDE_RANGE", index: 0 },
    });
    expect(overflow.body.error).toMatchObject({
      code: "TODO_IMPORT_2309",
      details: { limit: TODO_IMPORT_LIMITS.MAX_ITEMS_PER_IMPORT },
    });
    expect(foreign.body.error).toMatchObject({ code: "TODO_IMPORT_2304", details: { importId } });
    expect(afterCommit.body.error).toMatchObject({
      code: "TODO_IMPORT_2305",
      details: { status: "QUEUED" },
    });
  });

  it("업로드 중 취소하면 진행 중 가져오기가 없어진다", async () => {
    // Given
    const { accessToken, categoryId } = await userWithCategory("import-cancel@test.com");
    const importId = (await start(accessToken, categoryId).expect(201)).body.data.todoImport.id;
    await upload(accessToken, importId, itemsOf(["a"])).expect(200);

    // When
    const canceled = await http()
      .delete(`/v1/todo-imports/${importId}`)
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);
    const active = await http()
      .get("/v1/todo-imports/active")
      .set("Authorization", `Bearer ${accessToken}`)
      .expect(200);

    // Then
    expect(canceled.body.data.todoImport.status).toBe("CANCELED");
    expect(active.body.data).toEqual({ todoImport: null });
  });
});
