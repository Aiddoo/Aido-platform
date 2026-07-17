import request from "supertest";
import { RedisEvictionPolicyProbe } from "@/health/indicators/redis-eviction-policy.probe";
import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers";

describe("queue Redis policy health E2E", () => {
	let ctx: E2eTestContext;
	const inspect = jest.fn();

	beforeAll(async () => {
		ctx = await createE2eApp({
			customizeBuilder: (builder) =>
				builder
					.overrideProvider(RedisEvictionPolicyProbe)
					.useValue({ inspect }),
			additionalResetters: [() => inspect.mockReset()],
		});
	});

	afterAll(async () => {
		await destroyE2eApp(ctx);
	});

	beforeEach(async () => {
		await ctx.reset();
	});

	it("noeviction이면 기존 health 성공 계약을 유지한다", async () => {
		inspect.mockResolvedValue({ state: "compatible", policy: "noeviction" });

		const response = await request(ctx.app.getHttpServer())
			.get("/health")
			.expect(200);

		expect(response.body.data.status).toBe("ok");
		expect(response.body.data.info.queues).toMatchObject({
			status: "up",
			"ai-suggestion": { active: 0, waiting: 0, failed: 0 },
		});
		expect(response.body.data.info.queues).not.toHaveProperty("degraded");
		expect(response.body.data.info.queues).not.toHaveProperty("reason");
	});

	it("비호환 정책이어도 200/up을 유지하고 기존 degraded 필드로만 알린다", async () => {
		inspect.mockResolvedValue({
			state: "incompatible",
			policy: "volatile-lru",
		});

		const response = await request(ctx.app.getHttpServer())
			.get("/health")
			.expect(200);

		expect(response.body.data.status).toBe("ok");
		expect(response.body.data.info.queues).toMatchObject({
			status: "up",
			degraded: true,
			reason: "redis maxmemory_policy incompatible with BullMQ: volatile-lru",
			"ai-suggestion": { active: 0, waiting: 0, failed: 0 },
		});
	});
});
