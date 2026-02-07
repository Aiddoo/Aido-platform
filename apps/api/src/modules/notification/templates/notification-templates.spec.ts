import {
	fillTemplate,
	NotificationMessageBuilder,
	SCHEDULER_TEMPLATES,
} from "./notification-templates";

// =============================================================================
// Tests
// =============================================================================

describe("notification-templates", () => {
	// =========================================================================
	// fillTemplate
	// =========================================================================

	describe("fillTemplate", () => {
		it("{key} 형식의 플레이스홀더를 올바르게 치환한다", () => {
			// Given
			const template = "{name}님 안녕하세요!";
			const variables = { name: "홍길동" };

			// When
			const result = fillTemplate(template, variables);

			// Then
			expect(result).toBe("홍길동님 안녕하세요!");
		});

		it("여러 개의 플레이스홀더를 동시에 치환한다", () => {
			// Given
			const template = "{greeting}, {name}님! 오늘 할일 {count}개";
			const variables = { greeting: "안녕", name: "홍길동", count: 5 };

			// When
			const result = fillTemplate(template, variables);

			// Then
			expect(result).toBe("안녕, 홍길동님! 오늘 할일 5개");
		});

		it("일치하는 변수가 없으면 플레이스홀더를 그대로 유지한다", () => {
			// Given
			const template = "{name}님, {missing} 값";
			const variables = { name: "홍길동" };

			// When
			const result = fillTemplate(template, variables);

			// Then
			expect(result).toBe("홍길동님, {missing} 값");
		});

		it("undefined 값이면 플레이스홀더를 그대로 유지한다", () => {
			// Given
			const template = "{name}님, {value} 값";
			const variables = { name: "홍길동", value: undefined };

			// When
			const result = fillTemplate(template, variables);

			// Then
			expect(result).toBe("홍길동님, {value} 값");
		});

		it("숫자 값을 문자열로 변환하여 치환한다", () => {
			// Given
			const template = "오늘의 할일 {count}개";
			const variables = { count: 42 };

			// When
			const result = fillTemplate(template, variables);

			// Then
			expect(result).toBe("오늘의 할일 42개");
		});
	});

	// =========================================================================
	// NotificationMessageBuilder.morningReminder
	// =========================================================================

	describe("NotificationMessageBuilder.morningReminder", () => {
		it("title에 count가 치환된다", () => {
			// Given
			const count = 3;

			// When
			const result = NotificationMessageBuilder.morningReminder(count);

			// Then
			expect(result.title).toBe("오늘 할일 3개");
		});

		it("body에 count가 치환된다", () => {
			// Given
			const count = 3;

			// When
			const result = NotificationMessageBuilder.morningReminder(count);

			// Then
			// MORNING_REMINDER body 템플릿에 {count} 플레이스홀더가 없으므로 원본 유지
			expect(result.body).toBe(SCHEDULER_TEMPLATES.MORNING_REMINDER.body);
		});
	});

	// =========================================================================
	// NotificationMessageBuilder.morningNoTodo
	// =========================================================================

	describe("NotificationMessageBuilder.morningNoTodo", () => {
		it("title이 MORNING_NO_TODO 템플릿을 반환한다", () => {
			// When
			const result = NotificationMessageBuilder.morningNoTodo();

			// Then
			expect(result.title).toBe(SCHEDULER_TEMPLATES.MORNING_NO_TODO.title);
		});

		it("body가 MORNING_NO_TODO 템플릿을 반환한다", () => {
			// When
			const result = NotificationMessageBuilder.morningNoTodo();

			// Then
			expect(result.body).toBe(SCHEDULER_TEMPLATES.MORNING_NO_TODO.body);
		});
	});

	// =========================================================================
	// NotificationMessageBuilder.eveningReminder
	// =========================================================================

	describe("NotificationMessageBuilder.eveningReminder", () => {
		it("모든 할일 완료 시 EVENING_COMPLETE 메시지를 반환한다", () => {
			// Given
			const completed = 5;
			const total = 5;

			// When
			const result = NotificationMessageBuilder.eveningReminder(
				completed,
				total,
			);

			// Then
			expect(result.title).toBe(SCHEDULER_TEMPLATES.EVENING_COMPLETE.title);
			expect(result.body).toBe(SCHEDULER_TEMPLATES.EVENING_COMPLETE.body);
		});

		it("부분 완료 시 title에 remaining이 치환된다", () => {
			// Given - 5개 중 2개 완료 → 나머지 3개
			const completed = 2;
			const total = 5;

			// When
			const result = NotificationMessageBuilder.eveningReminder(
				completed,
				total,
			);

			// Then
			expect(result.title).toBe(
				SCHEDULER_TEMPLATES.EVENING_PARTIAL.title.replace("{remaining}", "3"),
			);
			expect(result.body).toBe(SCHEDULER_TEMPLATES.EVENING_PARTIAL.body);
		});

		it("미완료 시 EVENING_NONE 메시지를 반환한다", () => {
			// Given - 아무것도 완료하지 않음
			const completed = 0;
			const total = 5;

			// When
			const result = NotificationMessageBuilder.eveningReminder(
				completed,
				total,
			);

			// Then
			expect(result.title).toBe(SCHEDULER_TEMPLATES.EVENING_NONE.title);
			expect(result.body).toBe(SCHEDULER_TEMPLATES.EVENING_NONE.body);
		});
	});
});
