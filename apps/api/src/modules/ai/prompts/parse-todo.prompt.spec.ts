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
			const prompt = buildParseTodoPrompt("내일 회의", "Asia/Seoul");
			expect(prompt).toContain('Parse: "내일 회의"');
		});

		it("Korean Todo Parser 헤더가 포함된다", () => {
			const prompt = buildParseTodoPrompt("테스트", "Asia/Seoul");
			expect(prompt).toContain("Korean Todo Parser");
		});

		it("recurrence endDate에 4주 후 날짜가 포함된다", () => {
			const now = new Date("2026-03-01T00:00:00.000Z");
			const prompt = buildParseTodoPrompt("매주 운동", "UTC", now);
			expect(prompt).toContain("2026-03-29");
		});

		it("JSON 출력 포맷이 포함된다", () => {
			const prompt = buildParseTodoPrompt("테스트", "UTC");
			expect(prompt).toContain('"title":"str"');
			expect(prompt).toContain('"startDate":"YYYY-MM-DD"');
			expect(prompt).toContain('"isAllDay":bool');
			expect(prompt).toContain('"isRecurring":bool');
			expect(prompt).toContain('"recurrence"');
		});
	});

	describe("Default 규칙", () => {
		it("날짜/시간 기본값 규칙이 포함된다", () => {
			const prompt = buildParseTodoPrompt("테스트", "UTC");
			expect(prompt).toContain("날짜없음→today");
			expect(prompt).toContain("시간없음→isAllDay:true");
		});

		it("긴급 표현 규칙이 포함된다", () => {
			const prompt = buildParseTodoPrompt("테스트", "UTC");
			expect(prompt).toContain("당장/지금/바로→today");
		});
	});

	describe("Time 규칙", () => {
		it("AM/PM 시간대 규칙이 포함된다", () => {
			const prompt = buildParseTodoPrompt("테스트", "UTC");
			expect(prompt).toContain("새벽/오전/아침→AM");
			expect(prompt).toContain("낮/오후/저녁/밤→PM");
		});

		it("특수 시간 표현이 포함된다", () => {
			const prompt = buildParseTodoPrompt("테스트", "UTC");
			expect(prompt).toContain("점심/정오→12:00");
			expect(prompt).toContain("자정→00:00");
			expect(prompt).toContain("N시반→N:30");
		});
	});

	describe("PastTime 규칙", () => {
		it("지난 시간 처리 규칙이 포함된다", () => {
			const prompt = buildParseTodoPrompt("테스트", "UTC");
			expect(prompt).toContain("날짜없이시간만+이미지남→내일");
			expect(prompt).toContain('날짜명시("오늘")→유지');
		});
	});

	describe("Date 규칙", () => {
		it("기본 날짜 표현이 포함된다", () => {
			const prompt = buildParseTodoPrompt("테스트", "UTC");
			expect(prompt).toContain("오늘→today");
			expect(prompt).toContain("내일→+1d");
			expect(prompt).toContain("모레/이틀후→+2d");
			expect(prompt).toContain("글피/사흘후→+3d");
			expect(prompt).toContain("나흘후→+4d");
		});

		it("상대 날짜 표현이 포함된다", () => {
			const prompt = buildParseTodoPrompt("테스트", "UTC");
			expect(prompt).toContain("N일후→+Nd");
			expect(prompt).toContain("N주후→+Nw");
			expect(prompt).toContain("N달후→+Nmo");
			expect(prompt).toContain("다음달→+1mo");
			expect(prompt).toContain("내년→next year");
		});
	});

	describe("Week 규칙", () => {
		it("요일 해석 규칙이 포함된다", () => {
			const prompt = buildParseTodoPrompt("테스트", "UTC");
			expect(prompt).toContain("요일만→이번주(미래면)/다음주(지났으면)");
			expect(prompt).toContain("이번주X요일→this week");
			expect(prompt).toContain("다음주X요일→next week");
		});

		it("주 단위 단독 사용 규칙이 포함된다", () => {
			const prompt = buildParseTodoPrompt("테스트", "UTC");
			expect(prompt).toContain("이번주→this week");
			expect(prompt).toContain("다음주→+7d");
			expect(prompt).toContain("다다음주→+14d");
		});
	});

	describe("DateExpr 규칙", () => {
		it("날짜 표현식 규칙이 포함된다", () => {
			const prompt = buildParseTodoPrompt("테스트", "UTC");
			expect(prompt).toContain("M월D일→해당날짜(지났으면내년)");
			expect(prompt).toContain("이번달N일→해당일(지났으면다음달)");
			expect(prompt).toContain("다음달N일→next month");
		});

		it("월초/월말/연초/연말 규칙이 포함된다", () => {
			const prompt = buildParseTodoPrompt("테스트", "UTC");
			expect(prompt).toContain("월초→1일(지났으면다음달)");
			expect(prompt).toContain("월말→말일");
			expect(prompt).toContain("연초→1/1");
			expect(prompt).toContain("연말→12/31");
		});
	});

	describe("Range 규칙", () => {
		it("범위 표현이 포함된다", () => {
			const prompt = buildParseTodoPrompt("테스트", "UTC");
			expect(prompt).toContain("~까지→endDate(startDate=today)");
			expect(prompt).toContain("~부터~까지→startDate+endDate");
			expect(prompt).toContain("N일/주동안→endDate=start+N");
		});
	});

	describe("NonRepeat 규칙", () => {
		it("주말 비반복 규칙이 포함된다", () => {
			const prompt = buildParseTodoPrompt("테스트", "UTC");
			expect(prompt).toContain("이번/다음주말→토요일(isRecurring:false)");
		});
	});

	describe("Repeat 규칙", () => {
		it("반복 규칙이 포함된다", () => {
			const prompt = buildParseTodoPrompt("테스트", "UTC");
			expect(prompt).toContain("매주→isRecurring:true+요일");
			expect(prompt).toContain("매일→MON~SUN");
			expect(prompt).toContain("매주주말→SAT+SUN");
			expect(prompt).toContain("매주평일→MON~FRI");
		});

		it("시스템 미지원 반복은 isRecurring:false로 처리된다", () => {
			const prompt = buildParseTodoPrompt("테스트", "UTC");
			expect(prompt).toContain("격주/격일/매달→isRecurring:false");
		});
	});

	describe("Compound 규칙", () => {
		it("반복+기간 복합 규칙이 포함된다", () => {
			const prompt = buildParseTodoPrompt("테스트", "UTC");
			expect(prompt).toContain("반복+기간→recurrence.endDate=시작+기간");
		});
	});

	describe("Title 규칙", () => {
		it("제목 추출 규칙이 포함된다", () => {
			const prompt = buildParseTodoPrompt("테스트", "UTC");
			expect(prompt).toContain("날짜/시간표현 제외, 핵심내용만");
		});
	});

	describe("기본값", () => {
		it("timezone 생략 시 UTC를 사용한다", () => {
			const utcDate = new Date("2026-02-25T20:00:00.000Z");
			const prompt = buildParseTodoPrompt("테스트", undefined, utcDate);
			expect(prompt).toContain("2026-02-25 20:00");
		});
	});
});
