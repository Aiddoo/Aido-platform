import { featureDiscoveryResponseSchema } from "@aido/api";
import request from "supertest";
import { vi } from "vitest";

import { GetFeatureDiscovery } from "#api/modules/app-config/application/use-cases/discovery/get-feature-discovery.use-case";

import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers/index.js";

describe("기능 발견 설정 (E2E)", () => {
  let ctx: E2eTestContext;

  beforeAll(async () => {
    ctx = await createE2eApp();
  }, 60000);

  afterAll(async () => {
    await destroyE2eApp(ctx);
  });

  beforeEach(async () => {
    await ctx.reset();
  });

  it("비활성 기능 설정은 raw로, 일반 endpoint 응답은 기존 envelope로 반환한다", async () => {
    // When
    const featureDiscovery = await request(ctx.app.getHttpServer())
      .get("/v1/app-config/feature-discovery")
      .expect(200);
    const root = await request(ctx.app.getHttpServer()).get("/v1").expect(200);

    // Then - kill switch는 중간 캐시 없이 다음 조회부터 즉시 반영된다
    expect(featureDiscovery.headers["cache-control"]).toBe("private, no-store");
    expect(featureDiscovery.body).toEqual({ enabled: false });

    // Then - the global response contract remains unchanged elsewhere
    expect(root.body).toMatchObject({
      success: true,
      data: "Hello World!",
    });
    expect(root.body.timestamp).toEqual(expect.any(Number));
  });

  it("모바일 Zod 계약으로 검증 가능한 활성 응답을 반환한다", async () => {
    // Given - use the real HTTP/interceptor path with an enabled rollout result
    const getFeatureDiscoveryUseCase = ctx.module.get(GetFeatureDiscovery);
    const response = {
      enabled: true as const,
      campaignId: "feature-discovery-2026-08",
      minAppVersion: "1.8.0",
      launchedAt: "2026-08-01T00:00:00.000Z",
      autoOpen: true,
    };
    vi.spyOn(getFeatureDiscoveryUseCase, "execute").mockReturnValueOnce(response);

    // When
    const result = await request(ctx.app.getHttpServer())
      .get("/v1/app-config/feature-discovery")
      .expect(200);

    // Then - no global data envelope is introduced and the shared mobile parser accepts it
    expect(result.body).toEqual(response);
    expect(featureDiscoveryResponseSchema.safeParse(result.body)).toEqual({
      success: true,
      data: response,
    });
  });
});
