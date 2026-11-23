import { AiSuggestionJobName, AiSuggestionRuntimeJobSchema } from "./ai-suggestion.queue.js";

const DATA = {
  userId: "user-1",
  timezone: "Asia/Seoul",
  localDate: "2026-11-16",
  trigger: "SCHEDULED",
};

describe("AiSuggestionRuntimeJobSchema", () => {
  it.each([
    { name: "아침 배치 작업", data: DATA, valid: true },
    { name: "지금 받기 작업", data: { ...DATA, trigger: "ON_DEMAND" }, valid: true },
    { name: "날씨 격자 칸을 싣는 1.16.0 작업", data: { ...DATA, weatherGrid: null }, valid: true },
    { name: "모르는 트리거", data: { ...DATA, trigger: "MANUAL" }, valid: false },
    {
      name: "날짜가 아닌 현지 날짜",
      data: { ...DATA, localDate: "2026-11-16T09:00" },
      valid: false,
    },
  ])("$name → $valid", ({ data, valid }) => {
    // When
    const result = AiSuggestionRuntimeJobSchema.safeParse({
      name: AiSuggestionJobName.ANALYZE,
      data,
    });

    // Then
    expect(result.success).toBe(valid);
  });
});
