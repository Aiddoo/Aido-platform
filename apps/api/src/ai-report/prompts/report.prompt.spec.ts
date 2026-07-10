import type { AggregatedReportData } from "../types";
import {
	buildReportPrompt,
	getReportAiResponseSchema,
	reportAiResponseSchema,
	reportAiResponseSchemaEn,
} from "./report.prompt";

const baseData: AggregatedReportData = {
	totalTodos: 20,
	completedTodos: 15,
	completionRate: 75,
	prevCompletionRate: 60,
	streakDays: 4,
	categoryBreakdown: [
		{ name: "운동", color: "#FF6B43", total: 10, completed: 8, rate: 80 },
		{ name: "업무", color: "#3B82F6", total: 10, completed: 7, rate: 70 },
	],
	dayPatterns: [
		{ day: "MON", total: 5, completed: 5, rate: 100 },
		{ day: "WED", total: 5, completed: 3, rate: 60 },
	],
	timePatterns: [{ hour: 9, count: 6 }],
	hasActivity: true,
};

describe("buildReportPrompt — locale 분기", () => {
	it("기본(ko)은 현행 한국어 프롬프트를 그대로 생성한다", () => {
		// Given / When
		const prompt = buildReportPrompt(baseData, "2026년 27주차", "WEEKLY", {
			prevTips: null,
		});

		// Then — 페르소나·데이터·규칙이 한국어 원문 그대로
		expect(prompt).toContain('너는 "아이도냥"');
		expect(prompt).toContain("달성률: 75% (15/20)");
		expect(prompt).toContain("월요일 (100%)");
		expect(prompt).toContain("행동과학 프레임워크");
		expect(prompt).toContain("2026년 27주차");
	});

	it("locale을 생략한 호출과 'ko'를 명시한 호출은 동일한 프롬프트를 생성한다", () => {
		// Given / When
		const implicit = buildReportPrompt(baseData, "2026년 27주차", "WEEKLY", {
			prevTips: null,
		});
		const explicit = buildReportPrompt(
			baseData,
			"2026년 27주차",
			"WEEKLY",
			{ prevTips: null },
			"ko",
		);

		// Then — 기존 유저 경로 무변화 보장
		expect(explicit).toBe(implicit);
	});

	it("en이면 영어 지시 프롬프트에 동일 데이터를 삽입한다", () => {
		// Given / When
		const prompt = buildReportPrompt(
			baseData,
			"Week 27, 2026",
			"WEEKLY",
			{ prevTips: ["Tip A"] },
			"en",
		);

		// Then
		expect(prompt).toContain('You are "Aido"');
		expect(prompt).toContain("Completion rate: 75% (15/20)");
		expect(prompt).toContain("Monday (100%)");
		expect(prompt).toContain("Write all text in English.");
		expect(prompt).toContain("Advice I gave last time");
		expect(prompt).toContain("Week 27, 2026");
		// 한국어 지시문이 섞이지 않아야 한다 (데이터의 카테고리명은 사용자 입력이라 허용)
		expect(prompt).not.toContain("아이도냥");
		expect(prompt).not.toContain("행동과학");
	});

	it("en 활동 없음 프롬프트도 영어로 생성한다", () => {
		// Given
		const noActivity = { ...baseData, hasActivity: false };

		// When
		const weekly = buildReportPrompt(
			noActivity,
			"Week 27, 2026",
			"WEEKLY",
			{ prevTips: null },
			"en",
		);
		const monthly = buildReportPrompt(
			noActivity,
			"July 2026",
			"MONTHLY",
			{ prevTips: null },
			"en",
		);

		// Then
		expect(weekly).toContain("No to-dos were registered");
		expect(monthly).toContain("No to-dos were registered");
		expect(weekly).not.toContain("등록된 할 일이 없었어");
	});
});

describe("getReportAiResponseSchema", () => {
	it("ko는 기존 스키마를, en은 영어 describe 스키마를 반환한다", () => {
		// Given / When / Then
		expect(getReportAiResponseSchema("ko")).toBe(reportAiResponseSchema);
		expect(getReportAiResponseSchema("en")).toBe(reportAiResponseSchemaEn);
	});
});
