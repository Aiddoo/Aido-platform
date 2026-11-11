import { ErrorCode, type ErrorCodeType, Errors } from "@aido/api/errors";
import request, { type Response } from "supertest";

import enErrors from "../../src/i18n/en/errors.json" with { type: "json" };
import {
  createE2eApp,
  destroyE2eApp,
  type E2eTestContext,
  type VerifiedUser,
} from "./helpers/index.js";

describe("오류 응답 message 언어 E2E", () => {
  let ctx: E2eTestContext;
  let user: VerifiedUser;

  beforeAll(async () => {
    ctx = await createE2eApp();
    user = await ctx.helpers.createVerifiedUser("error-locale@test.com", "Test1234!");
  }, 60_000);

  afterAll(async () => {
    await destroyE2eApp(ctx);
  });

  function failures(acceptLanguage: string | undefined): Promise<Response[]> {
    const server = ctx.app.getHttpServer();
    const withLanguage = (call: request.Test) =>
      acceptLanguage == null ? call : call.set("Accept-Language", acceptLanguage);
    return Promise.all([
      withLanguage(request(server).get("/v1/auth/me")).expect(401),
      withLanguage(
        request(server).get("/v1/memos/999999").set("Authorization", `Bearer ${user.accessToken}`),
      ).expect(404),
    ]);
  }

  /** message만 기대 문구로 바꾼 envelope를 같은 키 순서로 직렬화해 응답 원문과 비교한다. */
  function serializedWith(response: Response, message: string): string {
    return JSON.stringify({ ...response.body, error: { ...response.body.error, message } });
  }

  it.each([
    ["Accept-Language를 보내지 않은 옛 앱", undefined],
    ["한국어 앱", "ko-KR,ko;q=0.9"],
  ])("%s 요청의 오류 응답은 기존 한국어 응답과 바이트 단위로 같다", async (_name, header) => {
    // When
    const responses = await failures(header);

    // Then
    expect(responses.map((response) => response.body.error.code)).toEqual([
      ErrorCode.AUTH_0101,
      ErrorCode.MEMO_2001,
    ]);
    for (const response of responses) {
      const code: ErrorCodeType = response.body.error.code;
      expect(response.text).toBe(serializedWith(response, Errors[code].message));
      expect(response.headers["content-language"]).toBeUndefined();
    }
  });

  it.each([
    ["영어 앱", "en-US,en;q=0.9"],
    ["지원하지 않는 언어(일본어) 앱", "ja-JP,ja;q=0.9"],
  ])("%s 요청의 오류 message는 영어 문구다", async (_name, header) => {
    // When
    const responses = await failures(header);

    // Then
    for (const response of responses) {
      const code: ErrorCodeType = response.body.error.code;
      expect(response.text).toBe(serializedWith(response, enErrors[code]));
    }
    expect(responses[1]?.body.error.message).toBe("Memo not found");
  });
});
