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
          reqId: expect.any(Number),
        }),
      ]),
    );
    for (const secret of secrets) expect(logs.join("")).not.toContain(secret);
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
