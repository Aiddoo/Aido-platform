import { keepGroundedSentences } from "./report-grounding.js";

const evidence = {
  numbers: [24, 17, 71, 58, 13, 5, 8, 7, 88, 43, 2026],
  quotedTexts: ["2026년 43주차", "운동", "PT 3회권"],
};

describe("keepGroundedSentences", () => {
  it("근거 수치만 쓴 문장은 모두 남긴다", () => {
    // Given
    const text = "2026년 43주차에는 24개 중 17개를 끝냈어요. 지난주보다 13%p 올랐어요.";
    // When / Then
    expect(keepGroundedSentences(text, evidence)).toBe(text);
  });

  it("근거 밖 숫자가 있는 문장만 빼고 나머지는 이어 붙인다", () => {
    // Given - "2"와 "4"는 데이터에 없다
    const text =
      "You finished 17 of 24 to-dos. Select the 2 most important items first. Break the 4 unfinished tasks down.";
    // When
    const result = keepGroundedSentences(text, evidence);
    // Then
    expect(result).toBe("You finished 17 of 24 to-dos.");
  });

  it("사용자가 쓴 이름의 분량은 근거로 보고 단위가 다르면 거른다", () => {
    // Given - 카테고리 이름 "PT 3회권"
    // When / Then
    expect(keepGroundedSentences("PT 3회권 일정을 하루 골라보세요.", evidence)).toBe(
      "PT 3회권 일정을 하루 골라보세요.",
    );
    expect(keepGroundedSentences("3주 동안 이어가 보세요.", evidence)).toBe("");
  });
});
