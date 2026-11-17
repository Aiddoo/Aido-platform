import { NodeAdapter } from "@nestjs/platform-node";
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

  // supertest는 늘 127.0.0.1에서 붙어 socket 주소(게이트웨이·직접 접속)를 바꾸려고 light-my-request로 보낸다
  const recordedLoginIpsFrom = async (
    remoteAddress: string,
    forwardedFor: string,
  ): Promise<string[]> => {
    const adapter = testContext.app.getHttpAdapter();
    if (!(adapter instanceof NodeAdapter)) {
      throw new Error("E2E 앱은 NodeAdapter로 뜬다");
    }
    await adapter.inject({
      method: "POST",
      url: "/v1/auth/login",
      remoteAddress,
      headers: { "x-forwarded-for": forwardedFor },
      payload: { email: "ip-probe@test.com", password: "Wrong1234!" },
    });
    const attempts = await testContext.testDatabase.getClient().query.loginAttempt.findMany();
    return attempts.map((attempt) => attempt.ipAddress);
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

  it.each([
    [
      "공개 주소에서 바로 온 요청은 꾸민 X-Forwarded-For를 믿지 않고 socket 주소를 쓴다",
      "198.51.100.77",
      "203.0.113.250",
      "198.51.100.77",
    ],
    [
      "docker bridge 게이트웨이를 거친 요청은 Nginx가 붙인 맨 오른쪽 주소를 쓴다",
      "172.18.0.1",
      "1.2.3.4, 203.0.113.9",
      "203.0.113.9",
    ],
    [
      "IPv4-mapped 게이트웨이를 거친 IPv6 클라이언트는 그 IPv6 주소를 쓴다",
      "::ffff:172.18.0.1",
      "2001:db8::9",
      "2001:db8::9",
    ],
  ])("%s", async (_case, remoteAddress, forwardedFor, expectedIp) => {
    // When
    const recordedIps = await recordedLoginIpsFrom(remoteAddress, forwardedFor);

    // Then
    expect(recordedIps).toEqual([expectedIp]);
  });
});
