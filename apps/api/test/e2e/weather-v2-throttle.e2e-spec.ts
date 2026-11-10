import request from "supertest";

import { WEATHER_LOCATION_V2_THROTTLE } from "#api/modules/weather/locations/presentation/http/v2/weather-location.controller";

import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers/index.js";

describe("날씨 v2 위치 변경 요청 제한 E2E (실제 throttler, 직렬 실행)", () => {
  let ctx: E2eTestContext;
  const limit = WEATHER_LOCATION_V2_THROTTLE.UPDATE.default.limit;

  beforeAll(async () => {
    ctx = await createE2eApp({ withRealThrottler: true });
  }, 60_000);

  afterAll(async () => {
    await destroyE2eApp(ctx);
  });

  beforeEach(async () => {
    await ctx.reset();
  });

  function updateLocation(accessToken: string, attempt: number) {
    return request(ctx.app.getHttpServer())
      .put("/v2/weather/location")
      .set("Authorization", `Bearer ${accessToken}`)
      .set("X-Forwarded-For", "198.51.100.60")
      .send({ latitude: 10 + attempt, longitude: 100 + attempt });
  }

  it("같은 사용자는 분당 10회까지 위치를 바꾸고 11번째는 429다", async () => {
    // Given
    const user = await ctx.helpers.createVerifiedUser("v2-throttle@test.com", "Test1234!");
    for (let attempt = 0; attempt < limit; attempt += 1) {
      expect((await updateLocation(user.accessToken, attempt)).status).toBe(200);
    }
    // When
    const throttled = await updateLocation(user.accessToken, limit);
    // Then
    expect(limit).toBe(10);
    expect(throttled.status).toBe(429);
  });

  it("같은 IP를 쓰는 다른 사용자의 한도는 서로 독립이다", async () => {
    // Given
    const first = await ctx.helpers.createVerifiedUser("v2-first@test.com", "Test1234!");
    const second = await ctx.helpers.createVerifiedUser("v2-second@test.com", "Test1234!");
    for (let attempt = 0; attempt < limit; attempt += 1) {
      expect((await updateLocation(first.accessToken, attempt)).status).toBe(200);
    }
    // When
    const throttled = await updateLocation(first.accessToken, limit);
    const otherUser = await updateLocation(second.accessToken, 0);
    // Then
    expect(throttled.status).toBe(429);
    expect(otherUser.status).toBe(200);
  });
});
