import { jobSchema } from "./job.schema";

describe("jobSchema — 작업 런타임 설정", () => {
	it("미설정 시 현재 운영 인프라인 PostgreSQL backend를 선택한다", () => {
		const config = jobSchema.parse({});

		expect(config.JOB_BACKEND).toBe("postgres");
		expect(config.JOB_SCHEMA).toBe("pgboss");
		expect(config.JOB_SHUTDOWN_TIMEOUT_MS).toBe(90_000);
		expect(config.JOB_POLLING_INTERVAL_SECONDS).toBe(2);
	});

	it.each(["postgres", "redis"])("%s backend를 허용한다", (backend) => {
		expect(jobSchema.parse({ JOB_BACKEND: backend }).JOB_BACKEND).toBe(backend);
	});

	it("지원하지 않는 backend를 거부한다", () => {
		expect(() => jobSchema.parse({ JOB_BACKEND: "memory" })).toThrow();
	});
});
