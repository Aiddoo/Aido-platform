import {
  isGroundedTip,
  keepGroundedInsight,
  type ReportEvidence,
} from "./report-grounding.domain-service.js";

const evidence: ReportEvidence = {
  overallNumbers: [20, 15, 75, 4, 60, 15],
  items: [
    { key: "c1", numbers: [12, 11, 92] },
    { key: "c2", numbers: [8, 4, 50] },
  ],
  quotedTexts: ["11월 2주차", "업무", "운동", "Work", "PT 3회권", "Mom's list"],
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
    {
      name: "근거 이름 뒤에 조사가 붙어도 통과한다",
      insightKey: "c2",
      insight: "'운동'은 8개 중 4개를 끝냈고 '업무'처럼 꾸준했어요.",
      expected: "'운동'은 8개 중 4개를 끝냈고 '업무'처럼 꾸준했어요.",
    },
    {
      name: "영어 아포스트로피는 여는 따옴표로 보지 않는다",
      insightKey: null,
      insight: "You didn't drop 'Work', and it's your users' strongest area.",
      expected: "You didn't drop 'Work', and it's your users' strongest area.",
    },
    {
      name: "이름 안 아포스트로피는 근거 이름이면 통과한다",
      insightKey: null,
      insight: "You kept 'Mom's list' going all week.",
      expected: "You kept 'Mom's list' going all week.",
    },
    {
      name: "데이터에 없는 이름을 감싼 문장만 빼고 나머지는 이어 붙인다",
      insightKey: "c2",
      insight: "'운동' 카테고리는 8개 중 4개를 끝냈어요. 'Workout' 카테고리도 고르게 끝냈어요.",
      expected: "'운동' 카테고리는 8개 중 4개를 끝냈어요.",
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

  it("프롬프트 예시의 'Workout'을 옮겨 쓴 월간 리포트 문장은 숫자가 맞아도 뺀다", () => {
    // Given
    const monthly: ReportEvidence = {
      overallNumbers: [14, 12, 86, 3],
      items: [{ key: "c1", numbers: [3, 3, 100] }],
      quotedTexts: ["2026년 10월", "두부", "생활", "업무", "운동", "자기계발"],
    };
    const insight =
      "'두부' 카테고리는 3개를 모두 끝냈고, 'Workout' 같은 다른 카테고리도 고르게 끝냈어요.";
    // When
    const leaked = keepGroundedInsight(insight, "c1", monthly);
    const grounded = keepGroundedInsight(insight.replace("'Workout'", "'운동'"), "c1", monthly);
    // Then
    expect(leaked).toBe("");
    expect(grounded).toBe(
      "'두부' 카테고리는 3개를 모두 끝냈고, '운동' 같은 다른 카테고리도 고르게 끝냈어요.",
    );
  });
});

describe("isGroundedTip", () => {
  it.each([
    { tip: "'운동' 카테고리는 이번 주에 하루만 정해보세요.", expected: true },
    { tip: "'PT 3회권' 일정을 하루 골라보세요.", expected: true },
    { tip: "가장 중요한 2개를 먼저 등록해보세요.", expected: false },
    { tip: "Try 10 minutes of stretching on Monday.", expected: false },
    { tip: "'운동'은 이번 주에 할 날 하루만 미리 정해보세요.", expected: true },
    { tip: "Don't add more to 'Work' until it's clear.", expected: true },
    { tip: "Keep 'Mom's list' short this week.", expected: true },
    { tip: "'Workout' 카테고리는 이번 주에 할 날 하루만 미리 정해보세요.", expected: false },
  ])("$tip → $expected", ({ tip, expected }) => {
    // When
    const result = isGroundedTip(tip, evidence.quotedTexts);
    // Then
    expect(result).toBe(expected);
  });
});
