import { evaluateCheerCooldown } from "./cheer-cooldown";

describe("cheer-cooldown 도메인 서비스", () => {
	it("마지막 응원이 없으면 비활성", () => {
		const result = evaluateCheerCooldown(null);
		expect(result.isActive).toBe(false);
		expect(result.remainingSeconds).toBe(0);
	});

	it("방금 응원했으면 활성 + 남은 시간 > 0", () => {
		const result = evaluateCheerCooldown(new Date());
		expect(result.isActive).toBe(true);
		expect(result.remainingSeconds).toBeGreaterThan(0);
		expect(result.canCheerAt).toBeInstanceOf(Date);
	});

	it("오래 전 응원이면 비활성", () => {
		const longAgo = new Date(Date.now() - 1000 * 60 * 60 * 48);
		expect(evaluateCheerCooldown(longAgo).isActive).toBe(false);
	});
});
