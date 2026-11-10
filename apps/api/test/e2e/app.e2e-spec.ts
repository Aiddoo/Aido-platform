/**
 * App E2E 테스트
 *
 * @description
 * 애플리케이션 기본 엔드포인트 테스트
 * Testcontainers를 사용하여 독립적인 PostgreSQL 환경에서 테스트합니다.
 */

import request from "supertest";

import { ClockPort } from "#api/shared/application/ports/clock.port";
import {
  AFTER_COMMIT_TASK_REGISTRY,
  AfterCommitTaskRegistryPort,
  DOMAIN_EVENT_PUBLISHER,
  DomainEventPublisherPort,
  JOB_RUNTIME,
  JobRuntimePort,
  MUTATION_LOCK,
  MutationLockPort,
  OPERATIONAL_ALERT,
  OperationalAlertPort,
  SAVEPOINT_RUNNER,
  SavepointRunnerPort,
  UNIT_OF_WORK,
  UnitOfWorkPort,
} from "#api/shared/application/ports/index";

import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers/index.js";

describe("앱 컨트롤러 E2E", () => {
  let ctx: E2eTestContext;

  beforeAll(async () => {
    ctx = await createE2eApp();
  }, 60_000);

  afterAll(async () => {
    await destroyE2eApp(ctx);
  });

  beforeEach(async () => {
    await ctx.reset();
  });

  it("운영과 동일하게 API는 /v1 아래에서만 노출한다", async () => {
    // Given - 애플리케이션이 초기화된 상태

    // When - 운영 API prefix로 루트 경로 GET 요청
    await request(ctx.app.getHttpServer())
      .get("/v1")
      .expect(200)
      .expect((res) => {
        // Then - 응답 검증
        // ResponseTransformInterceptor가 적용되어 래핑된 응답 확인
        expect(res.body).toMatchObject({
          success: true,
          data: "Hello World!",
        });
        expect(res.body.timestamp).toBeDefined();
      });

    // Then - E2E에서만 열렸던 무-prefix 경로는 노출되지 않는다
    await request(ctx.app.getHttpServer()).get("/").expect(404);
  });

  it("CORS preflight가 X-Timezone 요청 헤더를 허용한다", async () => {
    // When - 웹 클라이언트가 timezone 헤더를 포함한 preflight를 보내면
    const response = await request(ctx.app.getHttpServer())
      .options("/v1")
      .set("Origin", "http://localhost:3000")
      .set("Access-Control-Request-Method", "GET")
      .set("Access-Control-Request-Headers", "x-timezone")
      .expect(204);

    // Then - 브라우저가 실제 인증 요청을 보낼 수 있도록 명시적으로 허용한다
    const allowedHeaders = String(response.headers["access-control-allow-headers"])
      .toLowerCase()
      .split(",")
      .map((header) => header.trim());
    expect(allowedHeaders).toContain("x-timezone");
  });

  it("공용 포트 클래스 토큰은 옛 Symbol 토큰과 같은 인스턴스를 준다", () => {
    // Given
    const tokenPairs = [
      [UnitOfWorkPort, UNIT_OF_WORK],
      [AfterCommitTaskRegistryPort, AFTER_COMMIT_TASK_REGISTRY],
      [MutationLockPort, MUTATION_LOCK],
      [SavepointRunnerPort, SAVEPOINT_RUNNER],
      [OperationalAlertPort, OPERATIONAL_ALERT],
      [DomainEventPublisherPort, DOMAIN_EVENT_PUBLISHER],
      [JobRuntimePort, JOB_RUNTIME],
    ] as const;

    // When
    const isSameInstance = tokenPairs.map(
      ([classToken, symbolToken]) => ctx.app.get(classToken) === ctx.app.get(symbolToken),
    );

    // Then
    expect(isSameInstance).toEqual(tokenPairs.map(() => true));
    expect(ctx.app.get(ClockPort).now()).toBeInstanceOf(Temporal.Instant);
  });
});
