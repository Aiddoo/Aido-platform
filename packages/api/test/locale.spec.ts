import { describe, expect, it } from "vitest";

import { findSupportedLocale, resolveSupportedLocale } from "../src/vocabulary/index.js";

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
    { raw: "ko_KR", expected: "ko" },
    { raw: "ko-Kore-KR", expected: "ko" },
    { raw: " En-gb ", expected: "en" },
  ])("$raw → $expected", ({ raw, expected }) => {
    // Given
    const reported = raw;

    // When
    const locale = resolveSupportedLocale(reported);

    // Then
    expect(locale).toBe(expected);
  });
});

describe("findSupportedLocale — 태그에서 지원 언어 찾기", () => {
  it.each([
    { tag: "ko", expected: "ko" },
    { tag: "en-Latn-US", expected: "en" },
    { tag: "ja-JP", expected: null },
    { tag: "", expected: null },
  ])("$tag → $expected", ({ tag, expected }) => {
    // Given
    const reported = tag;

    // When
    const locale = findSupportedLocale(reported);

    // Then
    expect(locale).toBe(expected);
  });
});
