import type { IncomingHttpHeaders } from "node:http";

import { ErrorCode, type ErrorCodeType } from "@aido/api/errors";
import { ExecutionContextHost } from "@nestjs/core/helpers/execution-context-host.js";
import { firstValueFrom, throwError } from "rxjs";

import { ErrorCodedException } from "#api/shared/domain/exceptions/error-coded.exception";
import { createRequestClientReader, runWithRequestHeaders } from "#test/mocks/request-client";

import {
  nudgeInteractionDisabled,
  nudgeInteractionNotFound,
} from "../../../application/nudges.errors.js";
import { ReleasedAppNudgeErrorInterceptor } from "./released-app-nudge-error.interceptor.js";

const interceptor = new ReleasedAppNudgeErrorInterceptor(createRequestClientReader());

async function sendError(headers: IncomingHttpHeaders, error: unknown): Promise<unknown> {
  return runWithRequestHeaders(headers, async () => {
    try {
      await firstValueFrom(
        interceptor.intercept(new ExecutionContextHost([{}, {}]), {
          handle: () => throwError(() => error),
        }),
      );
      return null;
    } catch (sent) {
      return sent;
    }
  });
}

function toErrorCode(error: unknown): ErrorCodeType | null {
  return error instanceof ErrorCodedException ? error.errorCode : null;
}

describe("ReleasedAppNudgeErrorInterceptor", () => {
  it.each([
    { client: "버전 헤더가 없는 앱", headers: {}, expected: ErrorCode.NUDGE_1105 },
    { client: "1.15.1 앱", headers: { "x-app-version": "1.15.1" }, expected: ErrorCode.NUDGE_1105 },
    // 앱은 nativeApplicationVersion(숫자만)을 보내 RC·TestFlight 빌드도 1.15.2다
    { client: "1.15.2 앱", headers: { "x-app-version": "1.15.2" }, expected: ErrorCode.NUDGE_1111 },
    {
      client: "SemVer 프리릴리스 1.15.2-rc.1",
      headers: { "x-app-version": "1.15.2-rc.1" },
      expected: ErrorCode.NUDGE_1105,
    },
    { client: "1.16.0 앱", headers: { "x-app-version": "1.16.0" }, expected: ErrorCode.NUDGE_1111 },
    {
      client: "형식이 틀린 버전",
      headers: { "x-app-version": "latest" },
      expected: ErrorCode.NUDGE_1105,
    },
  ])("기능 꺼짐을 $client에는 $expected로 보낸다", async ({ headers, expected }) => {
    // When
    const sent = await sendError(headers, nudgeInteractionDisabled());

    // Then
    expect(toErrorCode(sent)).toBe(expected);
  });

  it.each([
    { client: "1.15.1 앱", headers: { "x-app-version": "1.15.1" } },
    { client: "1.15.2 앱", headers: { "x-app-version": "1.15.2" } },
  ])("$client에도 꺼짐이 아닌 오류는 그대로 보낸다", async ({ headers }) => {
    // Given
    const notFound = nudgeInteractionNotFound();
    const unexpected = new Error("boom");

    // When
    const sentNotFound = await sendError(headers, notFound);
    const sentUnexpected = await sendError(headers, unexpected);

    // Then
    expect(sentNotFound).toBe(notFound);
    expect(sentUnexpected).toBe(unexpected);
  });
});
