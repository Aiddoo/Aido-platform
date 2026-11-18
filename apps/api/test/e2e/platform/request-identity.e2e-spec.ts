import request from "supertest";

import {
  createE2eApp,
  destroyE2eApp,
  type E2eTestContext,
} from "#test/e2e/helpers/e2e-app-factory";

describe("신뢰할 수 있는 요청 식별 E2E (실제 throttler, 직렬 실행)", () => {
  let testContext: E2eTestContext;

  beforeAll(async () => {
    testContext = await createE2eApp({
      withRealThrottler: true,
    });
  }, 60_000);

  afterAll(async () => {
    await destroyE2eApp(testContext);
  });

  beforeEach(async () => {
    await testContext.reset();
  });

  const rejectedRegistrationFrom = async (forwardedFor: string): Promise<number> => {
    const response = await request(testContext.app.getHttpServer())
      .post("/v1/auth/register")
      .set("X-Forwarded-For", forwardedFor)
      .send({});

    return response.status;
  };

  it("canonical client별 bucket을 분리하고 leftmost spoof로 소진 bucket을 우회시키지 않는다", async () => {
    // Given
    // 첫 canonical client가 등록 endpoint의 5회 quota를 소진
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect(await rejectedRegistrationFrom("198.51.100.10")).toBe(400);
    }

    // When
    // 별도 canonical client는 socket/proxy 공용 bucket이 아닌 새 bucket
    const secondClientStatus = await rejectedRegistrationFrom("198.51.100.11");

    // Then
    expect(secondClientStatus).toBe(400);

    // When
    // 공격자가 leftmost 값을 삽입하되 Nginx가 붙인 canonical IP는 오른쪽
    const spoofAttemptStatus = await rejectedRegistrationFrom("203.0.113.250, 198.51.100.10");

    // Then
    expect(spoofAttemptStatus).toBe(429);
  });
});
