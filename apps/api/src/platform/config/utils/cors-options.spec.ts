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
});
