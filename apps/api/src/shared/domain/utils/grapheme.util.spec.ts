import { truncateGraphemes } from "./grapheme.util.js";

describe("truncateGraphemes", () => {
  it("상한 이하 문자열은 그대로 돌려준다", () => {
    // Given
    const value = "운동하기";
    // When
    const result = truncateGraphemes(value, 4);
    // Then
    expect(result).toBe("운동하기");
  });

  it("서로게이트 쌍 이모지를 반으로 자르지 않는다", () => {
    // Given - 이모지 하나는 UTF-16 두 단위다
    const value = "가".repeat(9) + "😀";
    // When
    const result = truncateGraphemes(value, 10);
    // Then
    expect(result).toBe("가".repeat(9));
    expect(result.isWellFormed()).toBe(true);
  });

  it("결합 이모지 시퀀스는 통째로 남기거나 통째로 버린다", () => {
    // Given - 가족 이모지는 ZWJ로 이어진 한 문자다
    const family = "👨‍👩‍👧";
    // When
    const kept = truncateGraphemes(`a${family}b`, 1 + family.length);
    const dropped = truncateGraphemes(`a${family}b`, family.length);
    // Then
    expect(kept).toBe(`a${family}`);
    expect(dropped).toBe("a");
  });
});
