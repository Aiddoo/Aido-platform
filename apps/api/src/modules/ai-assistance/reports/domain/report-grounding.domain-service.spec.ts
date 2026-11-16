import {
  isNumberFreeTip,
  keepGroundedInsight,
  type ReportNumberEvidence,
} from "./report-grounding.domain-service.js";

const evidence: ReportNumberEvidence = {
  overallNumbers: [20, 15, 75, 4, 60, 15],
  items: [
    { key: "c1", numbers: [12, 11, 92] },
    { key: "c2", numbers: [8, 4, 50] },
  ],
  quotedTexts: ["11월 2주차", "업무", "PT 3회권"],
};

describe("keepGroundedInsight", () => {
  it.each([
    {
      name: "insightKey 항목의 숫자는 통과한다",
      insightKey: "c2",
      insight: "'운동' 카테고리는 8개 중 4개를 끝냈어요.",
      expected: "'운동' 카테고리는 8개 중 4개를 끝냈어요.",
    },
    {
      name: "다른 항목의 숫자를 붙인 문장은 뺀다",
      insightKey: "c2",
      insight: "'운동' 카테고리는 12개 중 11개를 끝냈어요.",
      expected: "",
    },
    {
      name: "insightKey가 null이면 항목 숫자를 쓴 문장은 뺀다",
      insightKey: null,
      insight: "'운동' 카테고리는 50%를 끝냈어요.",
      expected: "",
    },
    {
      name: "insightKey가 null이어도 전체 통계 숫자는 통과한다",
      insightKey: null,
      insight: "지난주보다 15%p 올라 75%를 끝냈어요.",
      expected: "지난주보다 15%p 올라 75%를 끝냈어요.",
    },
    {
      name: "모르는 key는 전체 통계로만 본다",
      insightKey: "c9",
      insight: "'운동' 카테고리는 50%를 끝냈어요.",
      expected: "",
    },
    {
      name: "근거 밖 숫자가 있는 문장만 빼고 나머지는 이어 붙인다",
      insightKey: "c1",
      insight: "You finished 11 of 12 Work to-dos. Break the 2 hardest ones down.",
      expected: "You finished 11 of 12 Work to-dos.",
    },
  ])("$name", ({ insightKey, insight, expected }) => {
    // When
    const result = keepGroundedInsight(insight, insightKey, evidence);
    // Then
    expect(result).toBe(expected);
  });

  it("사용자가 쓴 이름의 분량은 근거로 보고 단위가 다르면 뺀다", () => {
    // When
    const kept = keepGroundedInsight("'PT 3회권' 일정은 거의 다 끝냈어요.", null, evidence);
    const dropped = keepGroundedInsight("3주 동안 이어갔어요.", null, evidence);
    // Then
    expect(kept).toBe("'PT 3회권' 일정은 거의 다 끝냈어요.");
    expect(dropped).toBe("");
  });
});

describe("isNumberFreeTip", () => {
  it.each([
    { tip: "'운동' 카테고리는 이번 주에 하루만 정해보세요.", expected: true },
    { tip: "'PT 3회권' 일정을 하루 골라보세요.", expected: true },
    { tip: "가장 중요한 2개를 먼저 등록해보세요.", expected: false },
    { tip: "Try 10 minutes of stretching on Monday.", expected: false },
  ])("$tip → $expected", ({ tip, expected }) => {
    // When
    const result = isNumberFreeTip(tip, evidence.quotedTexts);
    // Then
    expect(result).toBe(expected);
  });
});
