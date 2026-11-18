import { recipientLocaleOf, resolveRecipientLocale } from "./recipient-locale.domain-service.js";

describe("resolveRecipientLocale — 알림 수신 언어", () => {
  it.each([
    { storedLocale: "ko", expected: "ko" },
    { storedLocale: "en", expected: "en" },
    { storedLocale: "en-US", expected: "en" },
    { storedLocale: "ja", expected: "en" },
    { storedLocale: "zh_TW", expected: "en" },
  ])("저장된 언어 $storedLocale은 $expected로 보낸다", ({ storedLocale, expected }) => {
    // Given
    const params = { storedLocale, lastRequestLocale: null };

    // When
    const locale = resolveRecipientLocale(params);

    // Then
    expect(locale).toBe(expected);
  });

  it("저장된 언어가 없으면 아무 언어도 보고하지 않던 옛 앱 사용자라 ko다", () => {
    // Given
    const params = { storedLocale: null, lastRequestLocale: null };

    // When
    const locale = resolveRecipientLocale(params);

    // Then
    expect(locale).toBe("ko");
  });

  it("저장된 언어가 없으면 마지막 요청 언어를 쓴다", () => {
    // Given
    const params = { storedLocale: null, lastRequestLocale: "en-US" };

    // When
    const locale = resolveRecipientLocale(params);

    // Then
    expect(locale).toBe("en");
  });

  it("저장된 언어가 마지막 요청 언어보다 먼저다", () => {
    // Given
    const params = { storedLocale: "ko", lastRequestLocale: "ja" };

    // When
    const locale = resolveRecipientLocale(params);

    // Then
    expect(locale).toBe("ko");
  });

  it("빈 문자열로 저장된 언어는 없는 것으로 본다", () => {
    // Given
    const params = { storedLocale: " ", lastRequestLocale: "ja" };

    // When
    const locale = resolveRecipientLocale(params);

    // Then
    expect(locale).toBe("en");
  });
});

describe("recipientLocaleOf — 여러 수신자의 언어", () => {
  it("저장값이 있는 수신자는 그 언어, 없는 수신자는 ko다", () => {
    // Given
    const storedLocales = new Map([
      ["english", "en-US"],
      ["korean", "ko"],
      ["unset", null],
    ]);

    // When
    const localeOf = recipientLocaleOf(storedLocales);

    // Then
    expect(["english", "korean", "unset", "missing"].map(localeOf)).toEqual([
      "en",
      "ko",
      "ko",
      "ko",
    ]);
  });
});
