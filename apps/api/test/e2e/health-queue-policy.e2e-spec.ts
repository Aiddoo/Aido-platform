import request from "supertest";
import { vi, type MockInstance } from "vitest";

import { JobRuntimePort } from "#api/shared/application/ports/job-runtime.port";

import { FakeJobRuntime } from "../mocks/fake-job-runtime.js";
import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers/index.js";

describe("영속 job runtime 상태 확인 E2E", () => {
  let ctx: E2eTestContext;
  const runtime = new FakeJobRuntime();
  let health: MockInstance<typeof runtime.health>;

  beforeAll(async () => {
    ctx = await createE2eApp({
      customizeBuilder: (builder) => builder.overrideProvider(JobRuntimePort).useValue(runtime),
      additionalResetters: [() => health?.mockClear()],
    });
  });

  afterAll(async () => {
    await destroyE2eApp(ctx);
  });

  beforeEach(async () => {
    health = vi.spyOn(runtime, "health");
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
        // defineQueue 큐는 실제 pg-boss 어댑터가 등록할 때 목록에 들어가므로 옛 목록의 큐로 본다
        "ai-report-generation.v1": {
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
