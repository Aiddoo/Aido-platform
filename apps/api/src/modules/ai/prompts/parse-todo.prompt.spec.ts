import { buildParseTodoPrompt } from "./parse-todo.prompt";

describe("buildParseTodoPrompt", () => {
	describe("system/prompt 분리", () => {
		it("system과 prompt를 분리하여 반환한다", () => {
			const result = buildParseTodoPrompt("테스트", "Asia/Seoul");
			expect(result).toHaveProperty("system");
			expect(result).toHaveProperty("prompt");
			expect(typeof result.system).toBe("string");
			expect(typeof result.prompt).toBe("string");
		});

		it("사용자 입력은 prompt에만 포함된다", () => {
			const result = buildParseTodoPrompt("내일 회의", "Asia/Seoul");
			expect(result.prompt).toContain("내일 회의");
			expect(result.system).not.toContain("내일 회의");
		});

		it("시간 규칙은 system에 포함된다", () => {
			const result = buildParseTodoPrompt("테스트", "UTC");
			expect(result.system).toContain("현재 시각:");
			expect(result.system).toContain("날짜가 없으면 오늘");
		});
	});

	describe("타임존 변환", () => {
		it("UTC 시간을 KST(Asia/Seoul)로 변환하여 system에 표시한다", () => {
			const utcDate = new Date("2026-02-25T20:00:00.000Z");
			const result = buildParseTodoPrompt("테스트", "Asia/Seoul", utcDate);
			expect(result.system).toContain("2026-02-26 05:00");
		});

		it("UTC 타임존이면 UTC 시간 그대로 표시한다", () => {
			const utcDate = new Date("2026-02-25T20:00:00.000Z");
			const result = buildParseTodoPrompt("테스트", "UTC", utcDate);
			expect(result.system).toContain("2026-02-25 20:00");
		});

		it("America/New_York 타임존을 올바르게 변환한다", () => {
			const utcDate = new Date("2026-02-25T20:00:00.000Z");
			const result = buildParseTodoPrompt(
				"테스트",
				"America/New_York",
				utcDate,
			);
			expect(result.system).toContain("2026-02-25 15:00");
		});

		it("자정 경계에서 날짜가 올바르게 변환된다", () => {
			const utcDate = new Date("2026-02-25T15:00:00.000Z");
			const result = buildParseTodoPrompt("테스트", "Asia/Seoul", utcDate);
			expect(result.system).toContain("2026-02-26 00:00");
		});
	});

	describe("한국어 요일 포맷", () => {
		it("한국어 요일이 system에 포함된다", () => {
			const utcDate = new Date("2026-02-25T00:00:00.000Z");
			const result = buildParseTodoPrompt("테스트", "Asia/Seoul", utcDate);
			expect(result.system).toMatch(/\(.\uc694\uc77c\)/);
		});
	});

	describe("프롬프트 구조", () => {
		it("제목 작성 규칙이 system에 포함된다", () => {
			const result = buildParseTodoPrompt("테스트", "UTC");
			expect(result.system).toContain("핵심 행동만 간결하게");
		});

		it("recurrence endDate에 4주 후 날짜가 포함된다", () => {
			const now = new Date("2026-03-01T00:00:00.000Z");
			const result = buildParseTodoPrompt("매주 운동", "UTC", now);
			expect(result.system).toContain("2026-03-29");
		});

		it("JSON 출력 포맷이 system에 포함된다", () => {
			const result = buildParseTodoPrompt("테스트", "UTC");
			expect(result.system).toContain('"title":"string"');
			expect(result.system).toContain('"startDate":"YYYY-MM-DD"');
		});
	});

	describe("날짜/시간 규칙", () => {
		it("기본 규칙이 포함된다", () => {
			const result = buildParseTodoPrompt("테스트", "UTC");
			expect(result.system).toContain("날짜가 없으면 오늘");
			expect(result.system).toContain("시간이 없으면 종일 일정");
		});

		it("시간 해석 규칙이 포함된다", () => {
			const result = buildParseTodoPrompt("테스트", "UTC");
			expect(result.system).toContain("새벽, 오전, 아침");
			expect(result.system).toContain("정오 → 12:00");
			expect(result.system).toContain("자정 → 00:00");
		});

		it("날짜 표현 규칙이 포함된다", () => {
			const result = buildParseTodoPrompt("테스트", "UTC");
			expect(result.system).toContain("오늘 → today");
			expect(result.system).toContain("내일 → +1일");
			expect(result.system).toContain("모레, 이틀 후 → +2일");
		});

		it("요일 약어 규칙이 포함된다", () => {
			const result = buildParseTodoPrompt("테스트", "UTC");
			expect(result.system).toContain("월=MON");
			expect(result.system).toContain("월수금 → MON+WED+FRI");
		});

		it("반복 일정 규칙이 포함된다", () => {
			const result = buildParseTodoPrompt("테스트", "UTC");
			expect(result.system).toContain("매주 → isRecurring: true");
			expect(result.system).toContain("매일 → MON~SUN");
		});
	});

	describe("WeekSpan 예시", () => {
		it("이번주 동적 few-shot 예시가 포함된다", () => {
			const now = new Date("2026-03-13T06:00:00.000Z");
			const result = buildParseTodoPrompt("테스트", "UTC", now);
			expect(result.system).toContain("이번주 운동");
			expect(result.system).toContain('"isRecurring":true');
			expect(result.system).toContain('"startDate":"2026-03-13"');
		});

		it("다음주 동적 few-shot 예시가 포함된다", () => {
			const now = new Date("2026-03-13T06:00:00.000Z");
			const result = buildParseTodoPrompt("테스트", "UTC", now);
			expect(result.system).toContain("다음주 회의");
			expect(result.system).toContain('"startDate":"2026-03-16"');
		});

		it("다다음주 동적 few-shot 예시가 포함된다", () => {
			const now = new Date("2026-03-13T06:00:00.000Z");
			const result = buildParseTodoPrompt("테스트", "UTC", now);
			expect(result.system).toContain("다다음주 발표");
			expect(result.system).toContain('"startDate":"2026-03-23"');
		});
	});

	describe("카테고리 배정", () => {
		it("카테고리 목록이 system에 포함된다", () => {
			const result = buildParseTodoPrompt("테스트", "UTC", new Date(), [
				{ id: 1, name: "업무" },
				{ id: 2, name: "운동" },
			]);
			expect(result.system).toContain('1:"업무"');
			expect(result.system).toContain('2:"운동"');
			expect(result.system).toContain("카테고리 배정");
		});

		it("카테고리가 없으면 카테고리 섹션이 없다", () => {
			const result = buildParseTodoPrompt("테스트", "UTC");
			expect(result.system).not.toContain("카테고리 배정");
		});
	});

	describe("기본값", () => {
		it("timezone 생략 시 UTC를 사용한다", () => {
			const utcDate = new Date("2026-02-25T20:00:00.000Z");
			const result = buildParseTodoPrompt("테스트", undefined, utcDate);
			expect(result.system).toContain("2026-02-25 20:00");
		});
	});
});
