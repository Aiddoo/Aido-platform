import { resolveWeatherReportLanguage } from "./weather-report-language.domain-service.js";

describe("날씨 리포트 언어 정규화", () => {
  it.each([
    ["ko", "ko"],
    ["en", "en"],
    [undefined, "en"],
  ] as const)("요청 locale %s는 %s로 공급자에 보낸다", (locale, expected) => {
    // Given
    const input = locale;
    // When
    const language = resolveWeatherReportLanguage(input);
    // Then
    expect(language).toBe(expected);
  });
});
