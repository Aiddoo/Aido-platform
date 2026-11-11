import { Controller, Get, type INestApplication, Logger, Post } from "@nestjs/common";
import { APP_INTERCEPTOR, Reflector } from "@nestjs/core";
import { ApiResponse } from "@nestjs/swagger";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { z } from "zod";

import { HttpLogEvent } from "#api/platform/logging/http-log";

import { RawResponse } from "../decorators/raw-response.decorator.js";
import { ApiSuccessResponse } from "../swagger/decorators/api-response.decorator.js";
import { ResponseContractInterceptor } from "./response-contract.interceptor.js";
import { ResponseTransformInterceptor } from "./response-transform.interceptor.js";

const memoSchema = z.object({ id: z.number().int(), createdAt: z.iso.datetime() });

@Controller("contract")
class ContractFixtureController {
  @Get("valid")
  @ApiSuccessResponse({ type: memoSchema })
  valid() {
    return { id: 1, createdAt: new Date("2026-11-10T00:00:00.000Z") };
  }

  @Get("invalid")
  @ApiSuccessResponse({ type: memoSchema })
  invalid() {
    return { id: "1", createdAt: "2026-11-10T00:00:00.000Z" };
  }

  @Get("raw")
  @RawResponse()
  @ApiResponse({ status: 200, standardSchema: z.object({ enabled: z.boolean() }) })
  raw() {
    return { enabled: "yes" };
  }

  @Post("created")
  @ApiSuccessResponse({ type: memoSchema })
  created() {
    return { id: 1, createdAt: "2026-11-10T00:00:00.000Z" };
  }

  @Get("undeclared")
  undeclared() {
    return { anything: true };
  }
}

describe("ResponseContractInterceptor", () => {
  let app: INestApplication;
  let errorLogs: unknown[];

  beforeEach(async () => {
    errorLogs = [];
    vi.spyOn(Logger.prototype, "error").mockImplementation((message: unknown) => {
      errorLogs.push(message);
    });
    const module = await Test.createTestingModule({
      controllers: [ContractFixtureController],
      providers: [{ provide: APP_INTERCEPTOR, useClass: ResponseTransformInterceptor }],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalInterceptors(new ResponseContractInterceptor(app.get(Reflector)));
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it("선언한 schema에 맞는 응답은 JSON으로 바뀐 값 그대로 보낸다", async () => {
    // Given
    const server = app.getHttpServer();
    // When
    const response = await request(server).get("/contract/valid");
    // Then
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ id: 1, createdAt: "2026-11-10T00:00:00.000Z" });
  });

  it("선언한 schema와 다른 응답은 500으로 막고 handler와 Zod issue를 남긴다", async () => {
    // Given
    const server = app.getHttpServer();
    // When
    const response = await request(server).get("/contract/invalid");
    // Then
    expect(response.status).toBe(500);
    expect(errorLogs).toContainEqual(
      expect.objectContaining({
        event: HttpLogEvent.RESPONSE_CONTRACT_VIOLATED,
        handler: "ContractFixtureController.invalid",
        issues: [expect.objectContaining({ path: ["data", "id"] })],
      }),
    );
  });

  it("raw 응답은 envelope 없이 body 전체를 선언과 비교한다", async () => {
    // Given
    const server = app.getHttpServer();
    // When
    const response = await request(server).get("/contract/raw");
    // Then
    expect(response.status).toBe(500);
    expect(errorLogs).toContainEqual(
      expect.objectContaining({ issues: [expect.objectContaining({ path: ["enabled"] })] }),
    );
  });

  it("선언한 성공 상태와 다른 상태로 응답하면 500으로 막는다", async () => {
    // Given
    const server = app.getHttpServer();
    // When
    const response = await request(server).post("/contract/created");
    // Then
    expect(response.status).toBe(500);
    expect(errorLogs).toContainEqual(
      expect.objectContaining({ statusCode: 201, declaredStatuses: [200] }),
    );
  });

  it("응답 schema를 선언하지 않은 route는 검사하지 않는다", async () => {
    // Given
    const server = app.getHttpServer();
    // When
    const response = await request(server).get("/contract/undeclared");
    // Then
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual({ anything: true });
  });
});
