import { evaluateNudgeCooldown, evaluateRemindNudgeCooldown } from "./nudge-cooldown";

describe("nudge-cooldown 도메인 서비스", () => {
	describe("evaluateNudgeCooldown (24h)", () => {
		it("마지막 콕 찌르기가 없으면 비활성", () => {
			const result = evaluateNudgeCooldown(null);
			expect(result.isActive).toBe(false);
			expect(result.remainingSeconds).toBe(0);
		});

		it("방금 찔렀으면 활성 + 남은 시간 > 0", () => {
			const result = evaluateNudgeCooldown(new Date());
			expect(result.isActive).toBe(true);
			expect(result.remainingSeconds).toBeGreaterThan(0);
			expect(result.cooldownEndsAt).toBeInstanceOf(Date);
		});

		it("24시간 넘게 지났으면 비활성", () => {
			const longAgo = new Date(Date.now() - 1000 * 60 * 60 * 25);
			expect(evaluateNudgeCooldown(longAgo).isActive).toBe(false);
		});
	});

	describe("evaluateRemindNudgeCooldown (1h)", () => {
		it("방금 보냈으면 활성", () => {
			expect(evaluateRemindNudgeCooldown(new Date()).isActive).toBe(true);
		});

		it("1시간 넘게 지났으면 비활성", () => {
			const longAgo = new Date(Date.now() - 1000 * 60 * 61);
			expect(evaluateRemindNudgeCooldown(longAgo).isActive).toBe(false);
		});
	});
});
