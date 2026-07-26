import { featureDiscoveryResponseSchema } from "@aido/validators";
import request from "supertest";
import { AppConfigFacade } from "@/app-config/application/facades/app-config.facade";
import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers";

describe("Feature discovery configuration (e2e)", () => {
	let ctx: E2eTestContext;

	beforeAll(async () => {
		ctx = await createE2eApp();
	}, 60000);

	afterAll(async () => {
		await destroyE2eApp(ctx);
	});

	beforeEach(async () => {
		await ctx.reset();
	});

	it("returns the raw fail-closed config while ordinary endpoints remain wrapped", async () => {
		// When
		const featureDiscovery = await request(ctx.app.getHttpServer())
			.get("/v1/app-config/feature-discovery")
			.expect(200);
		const root = await request(ctx.app.getHttpServer()).get("/v1").expect(200);

		// Then - rollout config is a raw discriminated union and remains cacheable
		expect(featureDiscovery.headers["cache-control"]).toBe(
			"public, max-age=300",
		);
		expect(featureDiscovery.body).toEqual({ enabled: false });

		// Then - the global response contract remains unchanged elsewhere
		expect(root.body).toMatchObject({
			success: true,
			data: "Hello World!",
		});
		expect(root.body.timestamp).toEqual(expect.any(Number));
	});

	it("returns an enabled wire response that the mobile Zod contract parses", async () => {
		// Given - use the real HTTP/interceptor path with an enabled rollout result
		const facade = ctx.module.get(AppConfigFacade);
		const response = {
			enabled: true as const,
			campaignId: "feature-discovery-2026-08",
			minAppVersion: "1.8.0",
			launchedAt: "2026-08-01T00:00:00.000Z",
			autoOpen: true,
		};
		jest.spyOn(facade, "getFeatureDiscovery").mockReturnValueOnce(response);

		// When
		const result = await request(ctx.app.getHttpServer())
			.get("/v1/app-config/feature-discovery")
			.expect(200);

		// Then - no global data envelope is introduced and the shared mobile parser accepts it
		expect(result.body).toEqual(response);
		expect(featureDiscoveryResponseSchema.safeParse(result.body)).toEqual({
			success: true,
			data: response,
		});
	});
});
