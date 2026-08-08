import type { SuggestionContext } from "../../types";
import {
	buildSuggestionPrompt,
	detectedPatternsSchema,
	detectedPatternsSchemaEn,
	getDetectedPatternsSchema,
} from "./detect-patterns.prompt";

const baseContext: SuggestionContext = {
	streak: "3일",
	currentDate: "2026-07-07 (화)",
	dayCompletionRates: "MON: 80%",
	timeCompletionRates: "09:00: 85%",
	categoryRates: "운동: 70%",
	missingRoutines: ["운동 (WED)"],
	weather: null,
	weeklyReportInsight: null,
	suggestionHistory: [],
	todos: [
		{
			startDate: "2026-07-01",
			title: "운동",
			scheduledTime: "07:00",
			completed: true,
			categoryId: 1,
			categoryName: "운동",
		},
	],
};

describe("buildSuggestionPrompt — locale 분기", () => {
	it("기본(ko)은 현행 한국어 프롬프트를 그대로 생성한다", () => {
		// Given / When
		const { system, prompt } = buildSuggestionPrompt(baseContext, 3);

		// Then
		expect(system).toContain("실행 가능한 루틴을 제안하는 코치야");
		expect(system).toContain("1~2개");
		expect(system).toContain("패턴으로 단정하지 마");
		expect(prompt).toContain("맞춤 루틴을 제안해줘");
		expect(prompt).toContain("<context_json>");
		expect(prompt).toContain('"title": "운동"');
	});

	it("locale 생략과 'ko' 명시는 동일한 프롬프트를 생성한다", () => {
		// Given / When
		const implicit = buildSuggestionPrompt(baseContext, 3);
		const explicit = buildSuggestionPrompt(baseContext, 3, "ko");

		// Then
		expect(explicit.system).toBe(implicit.system);
		expect(explicit.prompt).toBe(implicit.prompt);
	});

	it("en이면 영어 지시 프롬프트에 동일 데이터를 삽입한다", () => {
		// Given / When
		const { system, prompt } = buildSuggestionPrompt(baseContext, 3, "en");

		// Then
		expect(system).toContain("suggests actionable routines");
		expect(system).toContain("1-2");
		expect(system).toContain("Do not call it a detected pattern");
		expect(prompt).toContain("Write title and reason in English.");
		expect(prompt).toContain('"title": "운동"');
		expect(system).not.toContain("루틴을 제안하는 코치야");
	});

	it("충분한 기록에서는 억지로 5개를 채우지 않고 강한 제안만 최대 5개 요청한다", () => {
		const context = {
			...baseContext,
			todos: Array(3).fill(baseContext.todos[0]),
		};
		const { system } = buildSuggestionPrompt(context, 3);

		expect(system).toContain("0~5개");
		expect(system).toContain("근거가 약하면 만들지 마");
		expect(system).not.toContain("반드시 정확히 5개");
	});
});

describe("getDetectedPatternsSchema", () => {
	it("ko는 기존 스키마를, en은 영어 describe 스키마를 반환한다", () => {
		// Given / When / Then
		expect(getDetectedPatternsSchema("ko")).toBe(detectedPatternsSchema);
		expect(getDetectedPatternsSchema("en")).toBe(detectedPatternsSchemaEn);
	});
});
