import { decideRetentionOutboxRetry } from "./retention-outbox-retry.policy";

describe("decideRetentionOutboxRetry", () => {
	it("지수 백오프를 15분으로 제한한다", () => {
		expect(decideRetentionOutboxRetry(0)).toEqual({
			delayMs: 1_000,
			hasExhaustedRetries: false,
		});
		expect(decideRetentionOutboxRetry(20)).toEqual({
			delayMs: 15 * 60_000,
			hasExhaustedRetries: true,
		});
	});
});
