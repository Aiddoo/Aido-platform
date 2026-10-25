import request from "supertest";

import { INVITE_CONFIG } from "#api/modules/social/application/ports/invites/invite.config.port";

import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers/index.js";

describe("초대 미리보기 요청 제한 E2E (실제 throttler, 직렬 실행)", () => {
  let ctx: E2eTestContext;

  beforeAll(async () => {
    ctx = await createE2eApp({
      withRealThrottler: true,
      customizeBuilder: (builder) =>
        builder.overrideProvider(INVITE_CONFIG).useValue({ isEnabled: true }),
    });
  }, 60_000);

  afterAll(async () => {
    await destroyE2eApp(ctx);
  });

  beforeEach(async () => {
    await ctx.reset();
  });

  it("같은 클라이언트의 공개 미리보기는 분당 20회까지 처리하고 21번째는 429다", async () => {
    // Given
    const preview = () =>
      request(ctx.app.getHttpServer())
        .get("/v1/invites/BBBBBB")
        .set("X-Forwarded-For", "198.51.100.40");
    for (let attempt = 0; attempt < 20; attempt += 1) {
      expect((await preview()).status).toBe(404);
    }

    // When
    const throttled = await preview();
    const otherClient = await request(ctx.app.getHttpServer())
      .get("/v1/invites/BBBBBB")
      .set("X-Forwarded-For", "198.51.100.41");

    // Then
    expect(throttled.status).toBe(429);
    expect(otherClient.status).toBe(404);
  });
});
