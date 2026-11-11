import { describe, expect, it } from "vitest";

import { resolveSupportedLocale } from "../src/vocabulary/index.js";

describe("resolveSupportedLocale — 지원 언어 정규화", () => {
  it.each([
    { raw: null, expected: "ko" },
    { raw: undefined, expected: "ko" },
    { raw: "", expected: "ko" },
    { raw: "   ", expected: "ko" },
    { raw: "ko", expected: "ko" },
    { raw: "ko-KR", expected: "ko" },
    { raw: "EN", expected: "en" },
    { raw: "en-US", expected: "en" },
    { raw: "ja", expected: "en" },
    { raw: "zh-Hans", expected: "en" },
  ])("$raw → $expected", ({ raw, expected }) => {
    // Given
    const reported = raw;

    // When
    const locale = resolveSupportedLocale(reported);

    // Then
    expect(locale).toBe(expected);
  });
});
