/**
 * AiUsage 값 객체 단위 테스트
 */
import { AiUsage } from "./ai-usage.vo";

describe("AiUsage — AI 사용량 값 객체", () => {
	const RESETS_AT = "2026-08-31T15:00:00.000Z";

	it("getter로 사용량/한도/리셋 시각을 노출한다", () => {
		const usage = AiUsage.of(3, 5, RESETS_AT);

		expect(usage.used).toBe(3);
		expect(usage.limit).toBe(5);
		expect(usage.resetsAt).toBe(RESETS_AT);
	});

	describe("isExceeded", () => {
		it("한도 미만이면 false", () => {
			expect(AiUsage.of(4, 5, RESETS_AT).isExceeded()).toBe(false);
		});

		it("한도 도달이면 true", () => {
			expect(AiUsage.of(5, 5, RESETS_AT).isExceeded()).toBe(true);
		});

		it("한도 초과면 true", () => {
			expect(AiUsage.of(6, 5, RESETS_AT).isExceeded()).toBe(true);
		});

		it("무제한(limit null)이면 항상 false", () => {
			expect(AiUsage.of(9999, null, RESETS_AT).isExceeded()).toBe(false);
		});
	});

	it("toView는 평면 객체를 반환한다", () => {
		expect(AiUsage.of(3, 5, RESETS_AT).toView()).toEqual({
			used: 3,
			limit: 5,
			resetsAt: RESETS_AT,
		});
	});
});
