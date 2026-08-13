import {
	RetentionJobName,
	RetentionRuntimeJobSchema,
} from "./retention-queue.constants";

describe("RetentionRuntimeJobSchema", () => {
	it("큐에서 복원한 dispatch payload를 검증한다", () => {
		expect(
			RetentionRuntimeJobSchema.safeParse({
				name: RetentionJobName.DISPATCH,
				data: { outboxId: "outbox-1" },
			}).success,
		).toBe(true);
		expect(
			RetentionRuntimeJobSchema.safeParse({
				name: RetentionJobName.DISPATCH,
				data: {},
			}).success,
		).toBe(false);
	});
});
