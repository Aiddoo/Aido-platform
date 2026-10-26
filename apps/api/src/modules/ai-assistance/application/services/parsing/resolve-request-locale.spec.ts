import { StubUserLocalePreferenceReader } from "#test/mocks/ports/ai-quota.stub";

import { resolveRequestLocale } from "./resolve-request-locale.js";

describe("resolveRequestLocale", () => {
  it("헤더가 모두 있으면 저장된 설정을 조회하지 않는다", async () => {
    // Given
    const reader = new StubUserLocalePreferenceReader();
    // When
    const result = await resolveRequestLocale(reader, "user-1", {
      timezone: "America/Los_Angeles",
      locale: "en",
    });
    // Then
    expect(result).toEqual({ timezone: "America/Los_Angeles", locale: "en" });
    expect(reader.readCount).toBe(0);
  });

  it("X-Timezone이 없으면 저장된 시간대를 쓰고 헤더 언어는 유지한다", async () => {
    // Given
    const reader = new StubUserLocalePreferenceReader();
    reader.preferences.set("user-1", { timezone: "Asia/Seoul", locale: "ko" });
    // When
    const result = await resolveRequestLocale(reader, "user-1", {
      timezone: undefined,
      locale: "en",
    });
    // Then
    expect(result).toEqual({ timezone: "Asia/Seoul", locale: "en" });
  });

  it("Accept-Language가 없으면 ko 대신 저장된 언어를 쓴다", async () => {
    // Given
    const reader = new StubUserLocalePreferenceReader();
    reader.preferences.set("user-1", { timezone: "UTC", locale: "en" });
    // When
    const result = await resolveRequestLocale(reader, "user-1", {
      timezone: "Asia/Seoul",
      locale: undefined,
    });
    // Then
    expect(result).toEqual({ timezone: "Asia/Seoul", locale: "en" });
  });
});
