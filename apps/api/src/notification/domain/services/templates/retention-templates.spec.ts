/**
 * 리텐션(D0/D1/D3/D7) 카피 계약 테스트.
 *
 * 기존 retention 모듈의 buildRetentionMessage를 이 빌더로 통합했다.
 * 아래 골든 값은 통합 직전 기존 함수의 출력에서 캡처한 것으로,
 * variant 선택·분석 variantId가 통합 후에도 **바이트 동일**함을 영구히 고정한다.
 * (시드/포맷을 건드리면 여기서 깨진다 → 기존 유저 카피·분석 회귀 방지)
 */
import { NotificationMessageBuilder } from "./notification-templates";

const ctx = (user: number) => ({
	recipientId: `user-${user}`,
	occurrenceKey: "2026-07-16",
});

describe("NotificationMessageBuilder.retention", () => {
	it("같은 사용자·단계·로컬 날짜는 재시도에도 같은 문구를 반환한다", () => {
		const first = NotificationMessageBuilder.retention(
			"D1",
			"d1_no_todo",
			"ko",
			ctx(1),
		);
		const retry = NotificationMessageBuilder.retention(
			"D1",
			"d1_no_todo",
			"ko",
			ctx(1),
		);

		expect(retry).toEqual(first);
		expect(first.variantId).toMatch(/^d1_no_todo\.v[1-3]$/);
	});

	it("여러 사용자에게 둘 이상의 카피 variant를 분산한다", () => {
		const messages = Array.from({ length: 30 }, (_, index) =>
			NotificationMessageBuilder.retention(
				"D3",
				"d3_restart",
				"ko",
				ctx(index),
			),
		);

		expect(
			new Set(messages.map((message) => message.variantId)).size,
		).toBeGreaterThan(1);
	});

	it("한국어는 친근한 반말이며 존댓말 종결을 쓰지 않는다", () => {
		const message = NotificationMessageBuilder.retention(
			"D7",
			"d7_restart",
			"ko",
			ctx(1),
		);

		expect(`${message.title} ${message.body}`).not.toMatch(
			/(하세요|해보세요|해요|이에요|예요)/,
		);
		expect(message.title).toMatch(/\p{Extended_Pictographic}/u);
	});

	it("ko/en은 같은 variant ID와 플레이스홀더 없는 문구를 제공한다", () => {
		const korean = NotificationMessageBuilder.retention(
			"D7",
			"d7_has_progress",
			"ko",
			ctx(1),
		);
		const english = NotificationMessageBuilder.retention(
			"D7",
			"d7_has_progress",
			"en",
			ctx(1),
		);

		expect(english.variantId).toBe(korean.variantId);
		expect(
			`${korean.title}${korean.body}${english.title}${english.body}`,
		).not.toMatch(/[{}]/);
	});

	it("context가 없으면 첫 variant(.v1)를 결정적으로 반환한다", () => {
		expect(
			NotificationMessageBuilder.retention("D3", "d3_restart", "ko"),
		).toEqual({
			title: "오늘부터 다시 시작해도 돼 🌱",
			body: "지금 필요한 일 하나만 새로 적어봐",
			variantId: "d3_restart.v1",
		});
	});

	// 통합 직전 buildRetentionMessage 출력에서 캡처한 골든 값 (바이트 동일 고정)
	it.each([
		[
			"D0",
			"d0_no_todo",
			"ko",
			0,
			{
				title: "오늘의 첫 계획을 적어봐 ✍️",
				body: "작은 할 일 하나면 시작하기 충분해",
				variantId: "d0_no_todo.v2",
			},
		],
		[
			"D1",
			"d1_no_todo",
			"en",
			0,
			{
				title: "Add the first task to your list 🌱",
				body: "One plan can make today feel clearer",
				variantId: "d1_no_todo.v3",
			},
		],
		[
			"D7",
			"d7_restart",
			"ko",
			2,
			{
				title: "다시 시작하기 좋은 날이야 ✨",
				body: "부담 없이 작은 계획부터 세워보자",
				variantId: "d7_restart.v3",
			},
		],
		[
			"D1",
			"d1_has_todo_no_completion",
			"en",
			2,
			{
				title: "Your first check is waiting 👀",
				body: "Finishing one small thing builds momentum",
				variantId: "d1_has_todo_no_completion.v3",
			},
		],
	] as const)(
		"[골든] %s:%s %s user-%d",
		(stage, variantId, locale, user, expected) => {
			expect(
				NotificationMessageBuilder.retention(
					stage,
					variantId,
					locale,
					ctx(user),
				),
			).toEqual(expected);
		},
	);
});
