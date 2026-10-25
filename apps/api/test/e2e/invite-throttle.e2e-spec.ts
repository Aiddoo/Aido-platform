import request from "supertest";

import { INVITE_CONFIG } from "#api/modules/social/application/ports/invites/invite.config.port";

import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers/index.js";

describe("초대 요청 제한 E2E (실제 throttler, 직렬 실행)", () => {
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

  it("링크 새로 만들기는 같은 IP를 쓰는 사용자끼리 한도를 나누지 않고 사용자마다 시간당 3회다", async () => {
    // Given
    const first = await ctx.helpers.createVerifiedUser("rotate-first@test.com", "Test1234!");
    const second = await ctx.helpers.createVerifiedUser("rotate-second@test.com", "Test1234!");
    const rotate = (accessToken: string) =>
      request(ctx.app.getHttpServer())
        .post("/v1/invites/me/rotate")
        .set("Authorization", `Bearer ${accessToken}`)
        .set("X-Forwarded-For", "198.51.100.50");
    for (let attempt = 0; attempt < 3; attempt += 1) {
      expect((await rotate(first.accessToken)).status).toBe(200);
    }

    // When
    const throttled = await rotate(first.accessToken);
    const otherUser = await rotate(second.accessToken);

    // Then
    expect(throttled.status).toBe(429);
    expect(otherUser.status).toBe(200);
  });
});
