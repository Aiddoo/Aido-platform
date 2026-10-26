import { normalizeReportPersona } from "./report-persona.js";

describe("normalizeReportPersona", () => {
  it.each([
    ["올랐어요냥.", "올랐어요."],
    ["등록해보세요 냥!", "등록해보세요!"],
    ["훌륭해요냥. 흐름이에요냥", "훌륭해요. 흐름이에요"],
  ])("ko 해요체 뒤에 붙은 냥을 지운다: %s", (input, expected) => {
    // Given / When
    const result = normalizeReportPersona(input, "ko");
    // Then
    expect(result).toBe(expected);
  });

  it("ko에서 어미를 바꾼 '~했냥'과 냥이 없는 문장은 그대로 둔다", () => {
    // Given
    const text = "4일 연속으로 기록했냥. 업무는 12개 중 11개를 완료했어요.";
    // When
    const result = normalizeReportPersona(text, "ko");
    // Then
    expect(result).toBe(text);
  });

  it("en 문장에 끼운 meow를 지우고 띄어쓰기·문장부호를 정리한다", () => {
    // Given
    const text = "That was a fantastic meow win. Nice work, meow.";
    // When
    const result = normalizeReportPersona(text, "en");
    // Then
    expect(result).toBe("That was a fantastic win. Nice work.");
  });

  it("en에서 meow가 들어간 다른 단어는 건드리지 않는다", () => {
    // Given
    const text = "You finished 3 of 4 Meowmix chores.";
    // When / Then
    expect(normalizeReportPersona(text, "en")).toBe(text);
  });
});
