import request from "supertest";
import { vi, type MockInstance } from "vitest";

import { JobQueuePort } from "#api/shared/application/ports/job-queue.port";
import { InMemoryJobQueue } from "#test/doubles/platform/in-memory-job-queue";

import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers/index.js";

describe("작업 큐 상태 확인 E2E", () => {
  let ctx: E2eTestContext;
  const jobQueue = new InMemoryJobQueue();
  let health: MockInstance<typeof jobQueue.health>;

  beforeAll(async () => {
    ctx = await createE2eApp({
      customizeBuilder: (builder) => builder.overrideProvider(JobQueuePort).useValue(jobQueue),
      additionalResetters: [() => health?.mockClear()],
    });
  });

  afterAll(async () => {
    await destroyE2eApp(ctx);
  });

  beforeEach(async () => {
    health = vi.spyOn(jobQueue, "health");
    await ctx.reset();
  });

  it("PostgreSQL backend이면 기존 200/up health 계약을 유지한다", async () => {
    const response = await request(ctx.app.getHttpServer()).get("/health").expect(200);

    expect(response.body.data.status).toBe("ok");
    expect(response.body.data.info.queues).toMatchObject({
      status: "up",
      backend: "postgres",
      degraded: false,
      queues: {
        // 부팅 때 worker를 등록한 큐가 목록에 들어간다
        "invite-reward.v1": {
          active: 0,
          waiting: 0,
          failed: 0,
        },
      },
    });
  });

  it("외부 호출 상태는 내부 정책 이름 없이 degraded만 공개한다", async () => {
    // When
    const response = await request(ctx.app.getHttpServer()).get("/health").expect(200);

    // Then
    expect(response.body.data.info.outbound).toEqual({ status: "up", degraded: false });
    expect(JSON.stringify(response.body)).not.toContain("openCircuits");
  });

  it("backend 장애도 200/up을 유지하고 degraded 필드로만 알린다", async () => {
    health.mockResolvedValueOnce({
      backend: "postgres",
      degraded: true,
      reason: "job_runtime_unavailable",
      queues: {},
    });

    const response = await request(ctx.app.getHttpServer()).get("/health").expect(200);

    expect(response.body.data.status).toBe("ok");
    expect(response.body.data.info.queues).toMatchObject({
      status: "up",
      backend: "postgres",
      degraded: true,
      reason: "job_runtime_unavailable",
    });
  });
});
