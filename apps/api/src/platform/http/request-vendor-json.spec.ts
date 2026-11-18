import { HttpClient, HttpParseError, HttpTimeoutError } from "@nestjs/http-client";

import { requestVendorJson } from "./request-vendor-json.js";

describe("requestVendorJson", () => {
  const url = "https://vendor.example/api";

  function clientResponding(respond: typeof globalThis.fetch, timeout?: number): HttpClient {
    return new HttpClient({ retry: false, throwOnHttpError: false, fetch: respond, timeout });
  }

  it("query를 URL에 직렬화하고 2xx JSON 본문을 반환한다", async () => {
    // Given
    const fetchSpy = vi.fn<typeof globalThis.fetch>(
      async () => new Response(JSON.stringify({ value: 1 })),
    );

    // When
    const outcome = await requestVendorJson(clientResponding(fetchSpy), {
      url,
      query: {
        serviceKey: "a+b/c=",
        nx: 60,
        skipped: undefined,
      },
    });

    // Then
    expect(outcome).toEqual({ kind: "success", body: { value: 1 } });
    const requestedUrl = new URL(String(fetchSpy.mock.calls[0]?.[0]));
    expect(Object.fromEntries(requestedUrl.searchParams)).toEqual({
      serviceKey: "a+b/c=",
      nx: "60",
    });
  });

  it.each([
    ["본문 없음", () => new Response(null, { status: 503 })],
    ["JSON 본문", () => new Response('{"error":true}', { status: 500 })],
    [
      "JSON이 아닌 본문",
      () =>
        new Response("<html>Bad Gateway</html>", {
          status: 502,
          headers: { "content-type": "application/json" },
        }),
    ],
  ])("non-2xx 응답은 본문 형태와 무관하게 상태 코드로 보고한다 (%s)", async (_name, respond) => {
    // When
    const outcome = await requestVendorJson(
      clientResponding(async () => respond()),
      { url, query: {} },
    );

    // Then
    expect(outcome).toMatchObject({ kind: "http_failure" });
  });

  it("2xx인데 JSON이 아닌 본문은 HttpParseError로 던진다", async () => {
    // When
    const result = requestVendorJson(
      clientResponding(async () => new Response("<xml/>")),
      { url, query: {} },
    );

    // Then
    await expect(result).rejects.toBeInstanceOf(HttpParseError);
  });

  it("client timeout을 넘기면 HttpTimeoutError로 던진다", async () => {
    // Given
    const neverResponding: typeof globalThis.fetch = (_input, init) =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => reject(init.signal?.reason));
      });

    // When
    const result = requestVendorJson(clientResponding(neverResponding, 10), { url, query: {} });

    // Then
    await expect(result).rejects.toBeInstanceOf(HttpTimeoutError);
  });
});
