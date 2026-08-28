import { pushSchema } from "./push.schema";

describe("pushSchema", () => {
	it("미설정 시 PostgreSQL rate limiter를 선택한다", () => {
		expect(pushSchema.parse({}).PUSH_RATE_LIMIT_BACKEND).toBe("postgres");
	});

	it.each(["postgres", "redis", "memory"] as const)("%s backend를 허용한다", (backend) => {
		expect(pushSchema.parse({ PUSH_RATE_LIMIT_BACKEND: backend }).PUSH_RATE_LIMIT_BACKEND).toBe(
			backend,
		);
	});

	it("지원하지 않는 backend를 거부한다", () => {
		expect(() => pushSchema.parse({ PUSH_RATE_LIMIT_BACKEND: "valkey" })).toThrow();
	});
});
