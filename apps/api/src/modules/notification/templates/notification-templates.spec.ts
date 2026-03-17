import {
	fillTemplate,
	NotificationMessageBuilder,
	pickVariant,
	SCHEDULER_TEMPLATES,
	SYSTEM_TEMPLATES,
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

		it("{key:이/가} 구문으로 받침에 맞는 조사를 붙인다", () => {
			// Given — 받침 있음: 홍길동 → 이
			expect(fillTemplate("{name:이/가} 했다", { name: "홍길동" })).toBe(
				"홍길동이 했다",
			);
			// Given — 받침 없음: 철수 → 가
			expect(fillTemplate("{name:이/가} 했다", { name: "철수" })).toBe(
				"철수가 했다",
			);
		});

		it("{key:을/를} 구문도 정상 동작한다", () => {
			expect(fillTemplate("{item:을/를} 완료", { item: "밥먹기" })).toBe(
				"밥먹기를 완료",
			);
			expect(fillTemplate("{item:을/를} 완료", { item: "운동" })).toBe(
				"운동을 완료",
			);
		});

		it("조사 구문과 일반 구문을 혼합 사용할 수 있다", () => {
			const result = fillTemplate("{name:이/가} {todo} 완료", {
				name: "홍길동",
				todo: "밥먹기",
			});
			expect(result).toBe("홍길동이 밥먹기 완료");
		});
	});

	// =========================================================================
	// pickVariant
	// =========================================================================

	describe("pickVariant", () => {
		afterEach(() => {
			jest.restoreAllMocks();
		});

		it("variants가 없으면 기본 title/body를 반환한다", () => {
			// Given
			const template = { title: "기본 제목", body: "기본 본문" };

			// When
			const result = pickVariant(template);

			// Then
			expect(result).toEqual({ title: "기본 제목", body: "기본 본문" });
		});

		it("variants가 빈 배열이면 기본 title/body를 반환한다", () => {
			// Given
			const template = {
				title: "기본 제목",
				body: "기본 본문",
				variants: [] as const,
			};

			// When
			const result = pickVariant(template);

			// Then
			expect(result).toEqual({ title: "기본 제목", body: "기본 본문" });
		});

		it("variants가 있으면 풀 내의 값을 반환한다", () => {
			// Given
			jest.spyOn(Math, "random").mockReturnValue(0);
			const template = {
				title: "기본",
				body: "기본",
				variants: [
					{ title: "변형1", body: "변형1본문" },
					{ title: "변형2", body: "변형2본문" },
				] as const,
			};

			// When
			const result = pickVariant(template);

			// Then — Math.random()=0 → index=0 → 첫 번째 variant
			expect(result).toEqual({ title: "변형1", body: "변형1본문" });
		});

		it("Math.random 값에 따라 다른 variant를 반환한다", () => {
			// Given — 0.99 → 마지막 variant 선택
			jest.spyOn(Math, "random").mockReturnValue(0.99);
			const template = {
				title: "기본",
				body: "기본",
				variants: [
					{ title: "첫째", body: "첫째본문" },
					{ title: "둘째", body: "둘째본문" },
					{ title: "셋째", body: "셋째본문" },
				] as const,
			};

			// When
			const result = pickVariant(template);

			// Then — Math.floor(0.99 * 3) = 2 → 셋째
			expect(result).toEqual({ title: "셋째", body: "셋째본문" });
		});
	});

	// =========================================================================
	// NotificationMessageBuilder (variants 적용 후)
	// =========================================================================

	describe("NotificationMessageBuilder", () => {
		beforeEach(() => {
			// 첫 번째 variant를 항상 선택하도록 고정
			jest.spyOn(Math, "random").mockReturnValue(0);
		});

		afterEach(() => {
			jest.restoreAllMocks();
		});

		// =====================================================================
		// morningReminder
		// =====================================================================

		describe("morningReminder", () => {
			it("title에 count가 치환된다", () => {
				// Given
				const count = 3;

				// When
				const result = NotificationMessageBuilder.morningReminder(count);

				// Then
				expect(result.title).toContain("3");
			});

			it("유효한 title/body를 반환한다", () => {
				// When
				const result = NotificationMessageBuilder.morningReminder(5);

				// Then
				expect(result.title).toBeTruthy();
				expect(result.body).toBeTruthy();
			});
		});

		// =====================================================================
		// morningNoTodo
		// =====================================================================

		describe("morningNoTodo", () => {
			it("variants 풀 내의 값을 반환한다", () => {
				// When
				const result = NotificationMessageBuilder.morningNoTodo();

				// Then
				const variants = SCHEDULER_TEMPLATES.MORNING_NO_TODO.variants;
				const allTitles = variants.map((v) => v.title);
				expect(allTitles).toContain(result.title);
			});
		});

		// =====================================================================
		// nudgeReceived
		// =====================================================================

		describe("nudgeReceived", () => {
			it("title에 이름(조사) + todoTitle이 포함된다 (받침 있음)", () => {
				// When
				const result = NotificationMessageBuilder.nudgeReceived(
					"홍길동",
					"밥먹기",
				);

				// Then — 첫 번째 variant
				expect(result.title).toBe("홍길동이 '밥먹기' 콕 찔렀어!");
			});

			it("title에 이름(조사) + todoTitle이 포함된다 (받침 없음)", () => {
				// When
				const result = NotificationMessageBuilder.nudgeReceived(
					"철수",
					"운동하기",
				);

				// Then
				expect(result.title).toBe("철수가 '운동하기' 콕 찔렀어!");
			});

			it("message가 없으면 body는 variants 풀 내의 값을 반환한다", () => {
				// When
				const result = NotificationMessageBuilder.nudgeReceived(
					"홍길동",
					"밥먹기",
				);

				// Then — 첫 번째 variant body
				expect(result.body).toBe("아직도 안 했어?");
			});

			it("message가 있으면 body에 메시지만 표시한다", () => {
				// When
				const result = NotificationMessageBuilder.nudgeReceived(
					"홍길동",
					"밥먹기",
					"같이 먹자",
				);

				// Then — WITH_MESSAGE 템플릿은 variants 없음, 고정 포맷
				expect(result.body).toBe("'같이 먹자'");
			});
		});

		// =====================================================================
		// eveningReminder
		// =====================================================================

		describe("eveningReminder", () => {
			it("모든 할일 완료 시 EVENING_COMPLETE variants 내의 값을 반환한다", () => {
				// When
				const result = NotificationMessageBuilder.eveningReminder(5, 5);

				// Then
				const variants = SCHEDULER_TEMPLATES.EVENING_COMPLETE.variants;
				const allTitles = variants.map((v) => v.title);
				expect(allTitles).toContain(result.title);
			});

			it("부분 완료 시 title에 remaining이 포함된다", () => {
				// Given - 5개 중 2개 완료 → 나머지 3개
				const result = NotificationMessageBuilder.eveningReminder(2, 5);

				// Then
				expect(result.title).toContain("3");
			});

			it("미완료 시 EVENING_NONE variants 내의 값을 반환한다", () => {
				// When
				const result = NotificationMessageBuilder.eveningReminder(0, 5);

				// Then
				const variants = SCHEDULER_TEMPLATES.EVENING_NONE.variants;
				const allTitles = variants.map((v) => v.title);
				expect(allTitles).toContain(result.title);
			});

			it("스트릭 7일이면 고정 메시지를 반환한다", () => {
				// When
				const result = NotificationMessageBuilder.eveningReminder(5, 5, 7);

				// Then — 고정 (variants 없음)
				expect(result.title).toBe("7일 연속! 일주일 내내 해냈어");
				expect(result.body).toBe("이거 실화냐");
			});

			it("스트릭 14일이면 고정 메시지를 반환한다", () => {
				// When
				const result = NotificationMessageBuilder.eveningReminder(5, 5, 14);

				// Then
				expect(result.title).toBe("2주 연속이다. 진심이구나");
			});

			it("스트릭 30일 이상이면 고정 메시지를 반환한다", () => {
				// When
				const result = NotificationMessageBuilder.eveningReminder(5, 5, 30);

				// Then
				expect(result.title).toBe("30일째. 전설이 되고 있어");
			});

			it("스트릭 2~6일이면 EVENING_STREAK variants 내의 값을 반환한다", () => {
				// When
				const result = NotificationMessageBuilder.eveningReminder(5, 5, 3);

				// Then
				expect(result.title).toContain("3");
			});

			it("스트릭 위기 + 일부 완료 시 streak과 remaining이 포함된다", () => {
				// When
				const result = NotificationMessageBuilder.eveningReminder(
					2,
					5,
					4,
					true,
				);

				// Then
				expect(result.title).toContain("4");
			});

			it("스트릭 위기 + 미완료 시 streak이 포함된다", () => {
				// When
				const result = NotificationMessageBuilder.eveningReminder(
					0,
					5,
					4,
					true,
				);

				// Then
				expect(result.title).toContain("4");
			});
		});

		// =====================================================================
		// billingIssue (variants 미적용)
		// =====================================================================

		describe("billingIssue", () => {
			it("결제 문제 알림 title을 반환한다", () => {
				// When
				const result = NotificationMessageBuilder.billingIssue();

				// Then
				expect(result.title).toBe("결제 문제가 발생했어요");
			});

			it("결제 문제 알림 body를 반환한다", () => {
				// When
				const result = NotificationMessageBuilder.billingIssue();

				// Then
				expect(result.body).toBe(
					"결제 수단을 확인해주세요. 구독이 중단될 수 있습니다.",
				);
			});
		});

		// =====================================================================
		// winback
		// =====================================================================

		describe("winback", () => {
			it("3일 미접속이면 WINBACK_DAY3 variants 내의 값을 반환한다", () => {
				// When
				const result = NotificationMessageBuilder.winback(3);

				// Then
				const variants = SYSTEM_TEMPLATES.WINBACK_DAY3.variants;
				const allTitles = variants.map((v) => v.title);
				expect(allTitles).toContain(result.title);
			});

			it("7일 미접속이면 WINBACK_DAY7 variants 내의 값을 반환한다", () => {
				// When
				const result = NotificationMessageBuilder.winback(7);

				// Then
				const variants = SYSTEM_TEMPLATES.WINBACK_DAY7.variants;
				const allTitles = variants.map((v) => v.title);
				expect(allTitles).toContain(result.title);
			});

			it("14일 미접속이면 WINBACK_DAY14를 반환한다", () => {
				const result = NotificationMessageBuilder.winback(14);
				const variants = SYSTEM_TEMPLATES.WINBACK_DAY14.variants;
				const allTitles = variants.map((v) => v.title);
				expect(allTitles).toContain(result.title);
			});

			it("21일 미접속이면 WINBACK_DAY21을 반환한다", () => {
				const result = NotificationMessageBuilder.winback(21);
				const variants = SYSTEM_TEMPLATES.WINBACK_DAY21.variants;
				const allTitles = variants.map((v) => v.title);
				expect(allTitles).toContain(result.title);
			});

			it("30일 미접속이면 WINBACK_DAY30을 반환한다", () => {
				const result = NotificationMessageBuilder.winback(30);
				const variants = SYSTEM_TEMPLATES.WINBACK_DAY30.variants;
				const allTitles = variants.map((v) => v.title);
				expect(allTitles).toContain(result.title);
			});
		});

		// =====================================================================
		// weeklyAchievement
		// =====================================================================

		describe("weeklyAchievement", () => {
			it("100% 완료 시 PERFECT variants 내의 값을 반환한다", () => {
				const result = NotificationMessageBuilder.weeklyAchievement(10, 10);
				const variants = SYSTEM_TEMPLATES.WEEKLY_ACHIEVEMENT_PERFECT.variants;
				const allTitles = variants.map((v) => v.title);
				expect(allTitles).toContain(result.title);
			});

			it("90% 이상이면 ALMOST variants 내의 값을 반환한다", () => {
				const result = NotificationMessageBuilder.weeklyAchievement(9, 10);
				expect(result.title).toContain("90");
			});

			it("90% 미만이면 completedCount가 치환된다", () => {
				const result = NotificationMessageBuilder.weeklyAchievement(5, 10);
				expect(result.title).toContain("5");
			});
		});

		// =====================================================================
		// onboarding
		// =====================================================================

		describe("onboarding", () => {
			it("Day 0이면 첫 할일 만들기 메시지를 반환한다", () => {
				const result = NotificationMessageBuilder.onboarding(0);
				expect(result).not.toBeNull();
				expect(result?.title).toBe("첫 할일을 만들어볼까?");
			});

			it("Day 5이면 completedCount가 치환된다", () => {
				const result = NotificationMessageBuilder.onboarding(5, 8);
				expect(result).not.toBeNull();
				expect(result?.title).toBe("벌써 8개 완료!");
			});

			it("Day 4이면 null을 반환한다 (발송 없는 날)", () => {
				const result = NotificationMessageBuilder.onboarding(4);
				expect(result).toBeNull();
			});

			it("Day 8이면 null을 반환한다 (온보딩 종료)", () => {
				const result = NotificationMessageBuilder.onboarding(8);
				expect(result).toBeNull();
			});
		});

		// =====================================================================
		// milestone
		// =====================================================================

		describe("milestone", () => {
			it("FIRST_COMPLETE 마일스톤 메시지를 반환한다", () => {
				const result = NotificationMessageBuilder.milestone("FIRST_COMPLETE");
				expect(result.title).toBe("첫 번째 완료!");
				expect(result.body).toBe("시작이 반이야");
			});

			it("COUNT_100 마일스톤 메시지를 반환한다", () => {
				const result = NotificationMessageBuilder.milestone("COUNT_100");
				expect(result.title).toBe("100개 달성!");
			});

			it("FIRST_FRIEND 마일스톤 메시지를 반환한다", () => {
				const result = NotificationMessageBuilder.milestone("FIRST_FRIEND");
				expect(result.title).toBe("첫 친구가 생겼어!");
			});
		});

		// =====================================================================
		// lunchNudge
		// =====================================================================

		describe("lunchNudge", () => {
			it("variants 풀 내의 값을 반환한다", () => {
				const result = NotificationMessageBuilder.lunchNudge();
				const variants = SCHEDULER_TEMPLATES.LUNCH_NUDGE.variants;
				const allTitles = variants.map((v) => v.title);
				expect(allTitles).toContain(result.title);
			});
		});

		// =====================================================================
		// streakAtRisk
		// =====================================================================

		describe("streakAtRisk", () => {
			it("streak이 title에 치환된다", () => {
				const result = NotificationMessageBuilder.streakAtRisk(5);
				expect(result.title).toContain("5");
			});
		});

		// =====================================================================
		// socialDigest
		// =====================================================================

		describe("socialDigest", () => {
			it("1명이면 SINGLE variants 내의 값을 반환한다", () => {
				const result = NotificationMessageBuilder.socialDigest(1, "홍길동");
				expect(result.title).toContain("홍길동");
			});

			it("2명 이상이면 MULTI variants 내의 값을 반환한다", () => {
				const result = NotificationMessageBuilder.socialDigest(3);
				expect(result.title).toContain("3");
			});
		});
	});
});
