import { AiSuggestionJobName, AiSuggestionRuntimeJobSchema } from "./ai-suggestion-queue";

describe("AiSuggestionRuntimeJobSchema", () => {
	it("AI 분석 좌표 payload를 런타임에 검증한다", () => {
		expect(
			AiSuggestionRuntimeJobSchema.safeParse({
				name: AiSuggestionJobName.ANALYZE,
				data: { userId: "user-1", timezone: "Asia/Seoul", weatherGrid: null },
			}).success,
		).toBe(true);
		expect(
			AiSuggestionRuntimeJobSchema.safeParse({
				name: AiSuggestionJobName.ANALYZE,
				data: { userId: "user-1", timezone: "Asia/Seoul" },
			}).success,
		).toBe(false);
	});
});
