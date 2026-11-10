import type { INestApplication } from "@nestjs/common";
import { BadRequestException, Controller, Get, Logger } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { Logger as PinoNestLogger, LoggerModule as PinoLoggerModule } from "nestjs-pino";
import request from "supertest";

import { HttpLogEvent } from "./http-log.js";
import { createLoggerOptions } from "./logger.options.js";

@Controller("oauth/callback")
class CallbackController {
  readonly #logger = new Logger(CallbackController.name);

  @Get("reject")
  reject() {
    throw new BadRequestException("유효하지 않은 요청");
  }

  @Get()
  callback() {
    this.#logger.log({ event: "test.oauth.callback.received", userId: "user-1" });
    return { success: true };
  }
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe("HTTP 로그 — 공식 Pino 연동과 인증 정보 비노출", () => {
  let app: INestApplication;
  let logs: string[];

  beforeEach(async () => {
    logs = [];
    const options = createLoggerOptions({ nodeEnv: "production", level: undefined });
    const module = await Test.createTestingModule({
      imports: [
        PinoLoggerModule.forRoot({
          ...options,
          pinoHttp: [options.pinoHttp, { write: (line: string) => logs.push(line) }],
        }),
      ],
      controllers: [CallbackController],
    }).compile();
    app = module.createNestApplication({ bufferLogs: true });
    app.useLogger(app.get(PinoNestLogger));
    await app.init();
    logs.length = 0;
  });

  afterEach(async () => {
    await app.close();
  });

  it("인증 query와 헤더는 기록하지 않고 요청 ID와 구조화된 이벤트는 남긴다", async () => {
    // Given
    const secrets = ["secret-state", "secret-code", "secret-token", "secret-cookie"];

    // When
    await request(app.getHttpServer())
      .get("/oauth/callback?state=secret-state&code=secret-code")
      .set("Authorization", "Bearer secret-token")
      .set("Cookie", "session=secret-cookie")
      .expect(200, { success: true });

    // Then
    const records = logs.map((line: string): Record<string, unknown> => JSON.parse(line));
    expect(records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event: HttpLogEvent.REQUEST_COMPLETED,
          path: "/oauth/callback",
          statusCode: 200,
        }),
        expect.objectContaining({
          event: "test.oauth.callback.received",
          userId: "user-1",
          reqId: expect.stringMatching(UUID_PATTERN),
        }),
      ]),
    );
    for (const secret of secrets) {
      expect(logs.join("")).not.toContain(secret);
    }
  });
  it("앱이 보낸 X-Request-Id를 로그의 reqId와 응답 헤더로 이어 쓴다", async () => {
    // Given
    const requestId = "3f2b8c1e-5d4a-4b6f-9e2d-1a7c8b9d0e1f";

    // When
    const response = await request(app.getHttpServer())
      .get("/oauth/callback")
      .set("X-Request-Id", requestId)
      .expect(200);

    // Then
    expect(response.headers["x-request-id"]).toBe(requestId);
    const records = logs.map((line: string): Record<string, unknown> => JSON.parse(line));
    expect(records).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ event: HttpLogEvent.REQUEST_COMPLETED, reqId: requestId }),
      ]),
    );
  });

  it("4xx 응답은 HTTP 자동 로그를 생략해 예외 필터와 중복 기록하지 않는다", async () => {
    // Given
    const callback = request(app.getHttpServer());

    // When
    await callback.get("/oauth/callback/reject?code=secret-code").expect(400);

    // Then
    expect(logs).toEqual([]);
  });
});

describe("로그 형식과 기본 레벨 — 실행 방식별", () => {
  it.each([
    { nodeEnv: "development", pretty: true, level: "debug" },
    { nodeEnv: "test", pretty: false, level: "silent" },
    { nodeEnv: "production", pretty: false, level: "info" },
  ] as const)(
    "NODE_ENV=$nodeEnv는 pretty=$pretty·레벨 $level로 기록한다",
    ({ nodeEnv, pretty, level }) => {
      // When
      const options = createLoggerOptions({ nodeEnv, level: undefined });

      // Then
      expect(options.pinoHttp.transport != null).toBe(pretty);
      expect(options.pinoHttp.level).toBe(level);
    },
  );
});
