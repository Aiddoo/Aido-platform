import {
	type EnqueueJobOptions,
	resolveDeadLetterJobPolicy,
	resolveDeadLetterQueue,
	resolveJobIdempotencyKey,
} from "./job-runtime.port";

const BASE_OPTIONS = {
	retryLimit: 2,
	retryDelaySeconds: 5,
	retryBackoff: true,
	expireInSeconds: 600,
	retentionSeconds: 14 * 24 * 60 * 60,
	deleteAfterSeconds: 7 * 24 * 60 * 60,
} as const;

function preserveOptions(options: EnqueueJobOptions): EnqueueJobOptions {
	return options;
}

describe("resolveJobIdempotencyKey", () => {
	it("신규 idempotencyKey를 우선 계약으로 반환한다", () => {
		expect(resolveJobIdempotencyKey({ ...BASE_OPTIONS, idempotencyKey: "notification_42" })).toBe(
			"notification_42",
		);
	});

	it("rolling 배포 동안 deprecated jobKey를 같은 값으로 해석한다", () => {
		expect(resolveJobIdempotencyKey({ ...BASE_OPTIONS, jobKey: "notification_42" })).toBe(
			"notification_42",
		);
	});

	it("identity가 없는 작업은 undefined를 반환한다", () => {
		expect(resolveJobIdempotencyKey(BASE_OPTIONS)).toBeUndefined();
	});

	it("두 identity 이름을 동시에 받지 않는 XOR 타입이다", () => {
		// @ts-expect-error rolling alias와 신규 이름은 서로 배타적이다.
		const invalidOptions: EnqueueJobOptions = {
			...BASE_OPTIONS,
			idempotencyKey: "new",
			jobKey: "legacy",
		};
		expect(preserveOptions(invalidOptions)).toBeDefined();
	});
});

describe("dead-letter queue policy normalization", () => {
	it("typed DLQ는 queue 이름과 독립 retry policy를 보존한다", () => {
		const jobPolicy = { ...BASE_OPTIONS };
		const deadLetter = { queue: "push-dead-letter.v1", jobPolicy } as const;

		expect(resolveDeadLetterQueue(deadLetter)).toBe("push-dead-letter.v1");
		expect(resolveDeadLetterJobPolicy(deadLetter)).toBe(jobPolicy);
	});

	it("rolling 배포의 legacy 문자열은 queue 이름만 보존한다", () => {
		expect(resolveDeadLetterQueue("push-dead-letter.v1")).toBe("push-dead-letter.v1");
		expect(resolveDeadLetterJobPolicy("push-dead-letter.v1")).toBeUndefined();
	});
});
