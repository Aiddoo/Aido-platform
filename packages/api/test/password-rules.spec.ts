import { describe, expect, it } from "vitest";

import { hasDisallowedPasswordCharacter, PASSWORD_RULES } from "../src/vocabulary/index.js";

describe("PASSWORD_RULES.PATTERN", () => {
  it("허용 특수문자로 만들어도 서버·출시 앱이 쓰던 정규식과 원문이 같다", () => {
    // Given
    const releasedPattern = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d@$!%*#?&]{8,}$/;

    // When
    const { source, flags } = PASSWORD_RULES.PATTERN;

    // Then
    expect(source).toBe(releasedPattern.source);
    expect(flags).toBe(releasedPattern.flags);
  });
});

describe("hasDisallowedPasswordCharacter", () => {
  it.each(["", "abcd", "abcd1234!", "Aa1@$!%*#?&"])(
    "%j는 PATTERN이 받는 문자만 있어 false를 돌려준다",
    (password) => {
      // When
      const result = hasDisallowedPasswordCharacter(password);

      // Then
      expect(result).toBe(false);
    },
  );

  it.each([
    "abcd1234.",
    "a,b",
    "a-b",
    "a/b",
    "a'b",
    "a^b",
    "a]b",
    "a\\b",
    "abcd 1234",
    "비밀번호1a",
    "abcd1234😀",
  ])("%j는 PATTERN이 받지 않는 문자가 있어 true를 돌려준다", (password) => {
    // When
    const result = hasDisallowedPasswordCharacter(password);

    // Then
    expect(result).toBe(true);
  });
});
