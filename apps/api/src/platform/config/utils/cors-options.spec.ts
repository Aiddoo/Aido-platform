import { createCorsOptions } from "./cors-options.js";

describe("createCorsOptions", () => {
  it("운영 설정 출처에 랜딩 aido.kr을 중복 없이 더한다", () => {
    // Given
    const configured = ["https://admin.aido.kr", "https://aido.kr"];

    // When
    const options = createCorsOptions("production", configured);

    // Then
    expect(options.origin).toEqual([
      "https://admin.aido.kr",
      "https://aido.kr",
      "https://www.aido.kr",
    ]);
  });

  it("요청 ID를 받고 응답의 요청 ID를 브라우저에 노출하며 쓰지 않는 X-Requested-With는 받지 않는다", () => {
    // Given / When
    const options = createCorsOptions("production", []);

    // Then
    expect(options.allowedHeaders).toContain("X-Request-Id");
    expect(options.allowedHeaders).not.toContain("X-Requested-With");
    expect(options.exposedHeaders).toEqual(["X-Request-Id"]);
  });

  it("앱·웹 Sentry가 보낸 추적을 이어 받도록 sentry-trace·baggage 헤더를 받는다", () => {
    // When
    const options = createCorsOptions("production", []);

    // Then
    expect(options.allowedHeaders).toEqual(expect.arrayContaining(["sentry-trace", "baggage"]));
  });
});
