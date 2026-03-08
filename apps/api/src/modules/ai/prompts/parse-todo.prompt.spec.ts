/**
 * buildParseTodoPrompt 단위 테스트
 *
 * 타임존 변환, 한국어 요일 포맷, 프롬프트 구조 검증
 */
import { buildParseTodoPrompt } from "./parse-todo.prompt";

describe("buildParseTodoPrompt", () => {
	describe("타임존 변환", () => {
		it("UTC 시간을 KST(Asia/Seoul)로 변환하여 프롬프트에 표시한다", () => {
			// Given - 2026-02-25 20:00 UTC = 2026-02-26 05:00 KST
			const utcDate = new Date("2026-02-25T20:00:00.000Z");

			// When
			const prompt = buildParseTodoPrompt("테스트", "Asia/Seoul", utcDate);

			// Then - KST 기준 날짜와 시간이 표시
			expect(prompt).toContain("2026-02-26 05:00");
			expect(prompt).not.toContain("2026-02-25 20:00");
		});

		it("UTC 타임존이면 UTC 시간 그대로 표시한다", () => {
			// Given
			const utcDate = new Date("2026-02-25T20:00:00.000Z");

			// When
			const prompt = buildParseTodoPrompt("테스트", "UTC", utcDate);

			// Then
			expect(prompt).toContain("2026-02-25 20:00");
		});

		it("America/New_York 타임존을 올바르게 변환한다", () => {
			// Given - 2026-02-25 20:00 UTC = 2026-02-25 15:00 EST
			const utcDate = new Date("2026-02-25T20:00:00.000Z");

			// When
			const prompt = buildParseTodoPrompt(
				"테스트",
				"America/New_York",
				utcDate,
			);

			// Then
			expect(prompt).toContain("2026-02-25 15:00");
		});

		it("자정 경계에서 날짜가 올바르게 변환된다", () => {
			// Given - 2026-02-25 15:00 UTC = 2026-02-26 00:00 KST (자정)
			const utcDate = new Date("2026-02-25T15:00:00.000Z");

			// When
			const prompt = buildParseTodoPrompt("테스트", "Asia/Seoul", utcDate);

			// Then - KST 자정이므로 다음 날로 표시
			expect(prompt).toContain("2026-02-26 00:00");
		});
	});

	describe("한국어 요일 포맷", () => {
		it("한국어 요일이 프롬프트에 포함된다", () => {
			// Given - 2026-02-25 = 수요일(KST 기준)
			const utcDate = new Date("2026-02-25T00:00:00.000Z");

			// When
			const prompt = buildParseTodoPrompt("테스트", "Asia/Seoul", utcDate);

			// Then - 한국어 요일 표시 (수요일)
			expect(prompt).toMatch(/\(.\uc694\uc77c\)/);
		});
	});

	describe("프롬프트 구조", () => {
		it("사용자 입력 텍스트가 프롬프트에 포함된다", () => {
			// When
			const prompt = buildParseTodoPrompt("내일 회의", "Asia/Seoul");

			// Then
			expect(prompt).toContain('Parse: "내일 회의"');
		});

		it("Korean Todo Parser 헤더가 포함된다", () => {
			// When
			const prompt = buildParseTodoPrompt("테스트", "Asia/Seoul");

			// Then
			expect(prompt).toContain("Korean Todo Parser");
		});

		it("시간 해석 규칙이 포함된다", () => {
			// When
			const prompt = buildParseTodoPrompt("테스트", "UTC");

			// Then
			expect(prompt).toContain("오전/아침→AM");
			expect(prompt).toContain("오후/저녁/밤→PM");
		});

		it("날짜 해석 규칙이 포함된다", () => {
			// When
			const prompt = buildParseTodoPrompt("테스트", "UTC");

			// Then
			expect(prompt).toContain("내일→+1d");
			expect(prompt).toContain("모레→+2d");
		});

		it("JSON 출력 포맷이 포함된다", () => {
			// When
			const prompt = buildParseTodoPrompt("테스트", "UTC");

			// Then
			expect(prompt).toContain('"title":"str"');
			expect(prompt).toContain('"startDate":"YYYY-MM-DD"');
			expect(prompt).toContain('"isAllDay":bool');
			expect(prompt).toContain('"isRecurring":bool');
			expect(prompt).toContain('"recurrence"');
		});

		it("반복 해석 규칙이 포함된다", () => {
			// When
			const prompt = buildParseTodoPrompt("테스트", "UTC");

			// Then
			expect(prompt).toContain("매주→isRecurring:true+요일");
			expect(prompt).toContain("매일→MON~SUN");
			expect(prompt).toContain("평일→MON~FRI");
		});

		it("recurrence endDate에 4주 후 날짜가 포함된다", () => {
			// Given
			const now = new Date("2026-03-01T00:00:00.000Z");

			// When
			const prompt = buildParseTodoPrompt("매주 운동", "UTC", now);

			// Then - 4주 후 = 2026-03-29
			expect(prompt).toContain("2026-03-29");
		});
	});

	describe("기본값", () => {
		it("timezone 생략 시 UTC를 사용한다", () => {
			// Given
			const utcDate = new Date("2026-02-25T20:00:00.000Z");

			// When
			const prompt = buildParseTodoPrompt("테스트", undefined, utcDate);

			// Then - UTC 시간 그대로
			expect(prompt).toContain("2026-02-25 20:00");
		});
	});
});
