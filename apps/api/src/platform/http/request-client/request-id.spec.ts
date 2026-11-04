import type { IncomingMessage, ServerResponse } from "node:http";

import { mockOf } from "#test/mocks/typed-mock";

import { assignRequestId, REQUEST_ID_HEADER } from "./request-id.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const APP_REQUEST_ID = "3f2b8c1e-5d4a-4b6f-9e2d-1a7c8b9d0e1f";

function exchange(headers: IncomingMessage["headers"]) {
  const request = mockOf<IncomingMessage>({ headers });
  const responseHeaders = new Map<string, unknown>();
  const response = mockOf<ServerResponse>();
  response.setHeader.mockImplementation((name, value) => {
    responseHeaders.set(name, value);
    return response;
  });
  return { request, response, responseHeaders };
}

describe("assignRequestId — 요청 ID", () => {
  it("앱이 보낸 UUID를 그대로 이어 쓰고 응답 헤더로 돌려준다", () => {
    // Given
    const { request, response, responseHeaders } = exchange({ "x-request-id": APP_REQUEST_ID });

    // When
    const requestId = assignRequestId(request, response);

    // Then
    expect(requestId).toBe(APP_REQUEST_ID);
    expect(request.id).toBe(APP_REQUEST_ID);
    expect(responseHeaders.get(REQUEST_ID_HEADER)).toBe(APP_REQUEST_ID);
  });

  it.each([
    ["없는 헤더", {}],
    ["UUID가 아닌 값", { "x-request-id": "abc\nforged-log-line" }],
    ["중복 헤더(배열)", { "x-request-id": [APP_REQUEST_ID, APP_REQUEST_ID] }],
  ])("%s면 새 UUID를 만든다", (_name, headers) => {
    // Given
    const { request, response, responseHeaders } = exchange(headers);

    // When
    const requestId = assignRequestId(request, response);

    // Then
    expect(requestId).toMatch(UUID_PATTERN);
    expect(responseHeaders.get(REQUEST_ID_HEADER)).toBe(requestId);
  });

  it("pino-http와 CLS middleware가 함께 불러도 같은 요청 ID를 쓴다", () => {
    // Given
    const { request, response } = exchange({});

    // When
    const first = assignRequestId(request, response);
    const second = assignRequestId(request, response);

    // Then
    expect(second).toBe(first);
    expect(response.setHeader).toHaveBeenCalledTimes(1);
  });
});
