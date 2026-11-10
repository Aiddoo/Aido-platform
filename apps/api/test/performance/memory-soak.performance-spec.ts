import { setTimeout as sleep } from "node:timers/promises";

import { count, eq } from "drizzle-orm";
import request from "supertest";
import { z } from "zod";

import { todo } from "#api/platform/database/schema/index";
import { defineQueue, JobQueuePort } from "#api/shared/application/ports/index";
import {
  createE2eApp,
  destroyE2eApp,
  type E2eTestContext,
  type VerifiedUser,
} from "#test/e2e/helpers/index";
import { preparePgBossSchema, useRealJobQueue } from "#test/e2e/helpers/real-job-queue";

/*
 * 측정(2026-11-10, Node 26.13, 로컬 macOS, Vitest fork worker, --no-flush-bytecode):
 * 준비 요청 3천 번·작업 5백 건 뒤 힙 204.6MB → 소크 뒤 205.2MB(+0.61·+0.62MB, 2회). 늘어난 몫은 old space 0.1MB,
 * JIT 코드(code·trusted space) 0.5MB다. flushing을 켠 채 소크를 6번 이어 돌려도 회차마다 -0.1~+0.5MB로 평탄했다.
 * 기준 4MB는 요청마다 1KB를 붙잡는 누수를 주입했을 때 +5.75MB로 실패하는 것을 확인했다.
 */
const WARM_UP = { requests: 3000, jobs: 500 };
const SOAK = { requests: 5000, jobs: 1000 };
const HEAP_GROWTH_LIMIT_BYTES = 4 * 1024 * 1024;
const USER_COUNT = 20;
const MB = 1024 * 1024;

const soakJobSchema = z.object({ userId: z.string(), sequence: z.number().int() });
const createdTodoSchema = z.object({ data: z.object({ todo: z.object({ id: z.number() }) }) });

const SOAK_QUEUE = defineQueue({
  name: "performance.memory-soak.v1",
  payloadSchema: soakJobSchema,
  retry: {
    retryLimit: 0,
    retryDelaySeconds: 1,
    retryBackoff: false,
    expireInSeconds: 30,
    retentionSeconds: 60 * 60,
    deleteAfterSeconds: 60 * 60,
  },
  worker: {
    localConcurrency: 2,
    pollingIntervalSeconds: 0.5,
    batchSize: 50,
    burstWhenBatchFull: true,
  },
});

/** 남은 쓰레기를 여러 번 치워 살아 있는 객체만 잰다. */
async function measureLiveMemory(): Promise<NodeJS.MemoryUsage> {
  const collect = globalThis.gc;
  if (collect == null) {
    throw new Error(
      "performance 프로젝트는 --expose-gc로 실행해야 한다(vitest.config.ts execArgv)",
    );
  }
  for (let round = 0; round < 12; round += 1) {
    collect();
    await sleep(100);
  }
  return process.memoryUsage();
}

/** 주요 인증 경로(할 일 생성·목록·수정·삭제, 메모 목록, 권한 조회)를 사용자마다 돌려 정확히 total번 보낸다. */
async function sendRepresentativeRequests(
  ctx: E2eTestContext,
  users: readonly VerifiedUser[],
  categoryIds: ReadonlyMap<string, number>,
  total: number,
): Promise<void> {
  const server = ctx.app.getHttpServer();
  let sent = 0;
  const claim = () => {
    if (sent >= total) {
      return false;
    }
    sent += 1;
    return true;
  };

  await Promise.all(
    users.map(async (user) => {
      const auth = { Authorization: `Bearer ${user.accessToken}`, "X-Timezone": "Asia/Seoul" };
      while (claim()) {
        const created = await request(server)
          .post("/v1/todos")
          .set(auth)
          .send({
            title: "소크",
            categoryId: categoryIds.get(user.userId),
            startDate: "2026-11-10",
          })
          .expect(201);
        const todoId = createdTodoSchema.parse(created.body).data.todo.id;
        if (!claim()) {
          return;
        }
        await request(server).get("/v1/todos").set(auth).expect(200);
        if (!claim()) {
          return;
        }
        await request(server)
          .patch(`/v1/todos/${todoId}`)
          .set(auth)
          .send({ title: "소크 수정" })
          .expect(200);
        if (!claim()) {
          return;
        }
        await request(server).delete(`/v1/todos/${todoId}`).set(auth).expect(200);
        if (!claim()) {
          return;
        }
        await request(server).get("/v1/memos").set(auth).expect(200);
        if (!claim()) {
          return;
        }
        await request(server).get("/v1/entitlements").set(auth).expect(200);
      }
    }),
  );
  expect(sent).toBe(total);
}

it(
  "주요 경로 5천 번과 실제 큐 작업 1천 건 뒤 GC한 힙 증가가 기준 이하다",
  { timeout: 600_000 },
  async () => {
    await preparePgBossSchema();
    const ctx = await createE2eApp({ customizeBuilder: useRealJobQueue });
    try {
      // Given
      const users: VerifiedUser[] = [];
      const categoryIds = new Map<string, number>();
      for (let index = 0; index < USER_COUNT; index += 1) {
        const user = await ctx.helpers.createVerifiedUser(`soak-${index}@example.com`, "Test1234!");
        users.push(user);
        categoryIds.set(user.userId, await ctx.helpers.getDefaultCategoryId(user.accessToken));
      }
      const userIdFor = (sequence: number): string => {
        const user = users[sequence % users.length];
        if (user == null) {
          throw new Error("소크 사용자가 없다");
        }
        return user.userId;
      };
      const database = ctx.testDatabase.getClient();
      const jobQueue = ctx.app.get(JobQueuePort);
      let processedJobs = 0;
      await jobQueue.work(SOAK_QUEUE, async (jobs) => {
        for (const job of jobs) {
          await database
            .select({ value: count() })
            .from(todo)
            .where(eq(todo.userId, job.data.userId));
        }
        processedJobs += jobs.length;
      });
      const processJobs = async (total: number) => {
        const target = processedJobs + total;
        for (let offset = 0; offset < total; offset += 100) {
          const size = Math.min(100, total - offset);
          await jobQueue.enqueueMany(
            SOAK_QUEUE,
            Array.from({ length: size }, (_, index) => ({
              payload: { userId: userIdFor(offset + index), sequence: offset + index },
            })),
          );
        }
        const deadline = Date.now() + 120_000;
        while (processedJobs < target && Date.now() < deadline) {
          await sleep(50);
        }
        expect(processedJobs).toBe(target);
      };
      await sendRepresentativeRequests(ctx, users, categoryIds, WARM_UP.requests);
      await processJobs(WARM_UP.jobs);
      const baseline = await measureLiveMemory();

      // When
      await sendRepresentativeRequests(ctx, users, categoryIds, SOAK.requests);
      await processJobs(SOAK.jobs);
      const after = await measureLiveMemory();

      // Then
      const heapGrowth = after.heapUsed - baseline.heapUsed;
      console.log(
        JSON.stringify({
          baselineHeapMb: +(baseline.heapUsed / MB).toFixed(1),
          afterHeapMb: +(after.heapUsed / MB).toFixed(1),
          heapGrowthMb: +(heapGrowth / MB).toFixed(2),
          baselineRssMb: +(baseline.rss / MB).toFixed(1),
          afterRssMb: +(after.rss / MB).toFixed(1),
        }),
      );
      expect(heapGrowth).toBeLessThan(HEAP_GROWTH_LIMIT_BYTES);
    } finally {
      await destroyE2eApp(ctx);
    }
  },
);
