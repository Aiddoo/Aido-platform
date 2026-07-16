import { buildRetentionMessage } from "./retention-message";

describe("buildRetentionMessage", () => {
	const context = {
		recipientId: "user-1",
		occurrenceKey: "2026-07-16",
	};

	it("같은 사용자·단계·로컬 날짜는 재시도에도 같은 문구를 반환한다", () => {
		const first = buildRetentionMessage("D1", "d1_no_todo", "ko", context);
		const retry = buildRetentionMessage("D1", "d1_no_todo", "ko", context);

		expect(retry).toEqual(first);
		expect(first.variantId).toMatch(/^d1_no_todo\.v[1-3]$/);
	});

	it("여러 사용자에게 둘 이상의 카피 variant를 분산한다", () => {
		const messages = Array.from({ length: 30 }, (_, index) =>
			buildRetentionMessage("D3", "d3_restart", "ko", {
				recipientId: `user-${index}`,
				occurrenceKey: "2026-07-16",
			}),
		);

		expect(
			new Set(messages.map((message) => message.variantId)).size,
		).toBeGreaterThan(1);
	});

	it("한국어는 친근한 반말이며 존댓말 종결을 쓰지 않는다", () => {
		const message = buildRetentionMessage("D7", "d7_restart", "ko", context);

		expect(`${message.title} ${message.body}`).not.toMatch(
			/(하세요|해보세요|해요|이에요|예요)/,
		);
		expect(message.title).toMatch(/\p{Extended_Pictographic}/u);
	});

	it("ko/en은 같은 variant ID와 플레이스홀더 없는 문구를 제공한다", () => {
		const korean = buildRetentionMessage(
			"D7",
			"d7_has_progress",
			"ko",
			context,
		);
		const english = buildRetentionMessage(
			"D7",
			"d7_has_progress",
			"en",
			context,
		);

		expect(english.variantId).toBe(korean.variantId);
		expect(
			`${korean.title}${korean.body}${english.title}${english.body}`,
		).not.toMatch(/[{}]/);
	});
});
