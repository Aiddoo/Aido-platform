import { AiSuggestionJobName, AiSuggestionRuntimeJobSchema } from "./ai-suggestion.queue.js";

const OLD_DATA = { userId: "user-1", timezone: "Asia/Seoul", weatherGrid: null };

describe("AiSuggestionRuntimeJobSchema", () => {
  it.each([
    { name: "1.16.0 전 작업(날짜·트리거 없음)", data: OLD_DATA, valid: true },
    {
      name: "지금 받기 작업",
      data: { ...OLD_DATA, localDate: "2026-11-16", trigger: "ON_DEMAND" },
      valid: true,
    },
    {
      name: "날씨 격자 칸이 없는 작업",
      data: { userId: "user-1", timezone: "Asia/Seoul" },
      valid: false,
    },
    { name: "모르는 트리거", data: { ...OLD_DATA, trigger: "MANUAL" }, valid: false },
    {
      name: "날짜가 아닌 현지 날짜",
      data: { ...OLD_DATA, localDate: "2026-11-16T09:00" },
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
