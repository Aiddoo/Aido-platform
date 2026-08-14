import request from "supertest";

import { JOB_RUNTIME } from "@/shared/application/ports/job-runtime.port";

import { FakeJobRuntime } from "../mocks/fake-job-runtime";
import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers";

describe("durable job runtime health E2E", () => {
	let ctx: E2eTestContext;
	const runtime = new FakeJobRuntime();
	const health = jest.spyOn(runtime, "health");

	beforeAll(async () => {
		ctx = await createE2eApp({
			customizeBuilder: (builder) => builder.overrideProvider(JOB_RUNTIME).useValue(runtime),
			additionalResetters: [() => health.mockClear()],
		});
	});

	afterAll(async () => {
		await destroyE2eApp(ctx);
	});

	beforeEach(async () => {
		await ctx.reset();
	});

	it("PostgreSQL backend이면 기존 200/up health 계약을 유지한다", async () => {
		const response = await request(ctx.app.getHttpServer()).get("/health").expect(200);

		expect(response.body.data.status).toBe("ok");
		expect(response.body.data.info.queues).toMatchObject({
			status: "up",
			backend: "postgres",
			degraded: false,
			queues: {
				"ai-suggestion-analysis.v1": {
					active: 0,
					waiting: 0,
					failed: 0,
				},
			},
		});
	});

	it("backend 장애도 200/up을 유지하고 degraded 필드로만 알린다", async () => {
		health.mockResolvedValueOnce({
			backend: "postgres",
			degraded: true,
			reason: "job_runtime_unavailable",
			queues: {},
		});

		const response = await request(ctx.app.getHttpServer()).get("/health").expect(200);

		expect(response.body.data.status).toBe("ok");
		expect(response.body.data.info.queues).toMatchObject({
			status: "up",
			backend: "postgres",
			degraded: true,
			reason: "job_runtime_unavailable",
		});
	});
});
