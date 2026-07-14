import { assignRetentionVariant } from "./experiment-assignment";

describe("assignRetentionVariant — 신규 사용자 실험 배정", () => {
	it("같은 사용자는 항상 같은 실험군에 배정한다", () => {
		const first = assignRetentionVariant("user-stable", 50);
		const second = assignRetentionVariant("user-stable", 50);

		expect(second).toBe(first);
	});

	it("처리 비율 0과 100의 경계를 지킨다", () => {
		expect(assignRetentionVariant("user-a", 0)).toBe("CONTROL");
		expect(assignRetentionVariant("user-a", 100)).toBe("TREATMENT");
	});
});
