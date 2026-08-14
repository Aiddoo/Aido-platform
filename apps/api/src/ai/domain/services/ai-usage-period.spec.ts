/**
 * ai-usage-period 도메인 서비스 단위 테스트 (KST 리셋 주기)
 */
import { isNewBillingMonth, nextBillingResetIso } from "./ai-usage-period";

describe("ai-usage-period — 사용량 리셋 주기", () => {
	describe("isNewBillingMonth", () => {
		it("마지막 리셋이 null이면 새로운 달로 본다", () => {
			expect(isNewBillingMonth(null, new Date("2026-04-15T00:00:00Z"))).toBe(true);
		});

		it("KST 기준 같은 달이면 false", () => {
			// 둘 다 KST 2026-04
			const reference = new Date("2026-04-30T14:00:00Z"); // KST 4/30 23:00
			const lastReset = new Date("2026-04-01T00:00:00Z"); // KST 4/1 09:00
			expect(isNewBillingMonth(lastReset, reference)).toBe(false);
		});

		it("KST 기준 다른 달이면 true", () => {
			const reference = new Date("2026-05-01T00:00:00Z"); // KST 5/1 09:00
			const lastReset = new Date("2026-04-15T00:00:00Z"); // KST 4/15
			expect(isNewBillingMonth(lastReset, reference)).toBe(true);
		});

		it("UTC상 같은 달이라도 KST 월 경계를 넘으면 새로운 달", () => {
			// UTC 4/30 16:00 = KST 5/1 01:00 → 5월
			const reference = new Date("2026-04-30T16:00:00Z");
			const lastReset = new Date("2026-04-10T00:00:00Z"); // KST 4월
			expect(isNewBillingMonth(lastReset, reference)).toBe(true);
		});
	});

	describe("nextBillingResetIso", () => {
		it("다음 달 1일 KST 00:00(UTC 전월 말 15:00)을 ISO로 반환한다", () => {
			// KST 2026-04-18 → 다음 리셋 KST 5/1 00:00 = UTC 4/30 15:00
			const iso = nextBillingResetIso(new Date("2026-04-18T05:00:00Z"));
			expect(iso).toBe("2026-04-30T15:00:00.000Z");
		});
	});
});
