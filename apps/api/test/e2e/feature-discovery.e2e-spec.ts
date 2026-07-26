import request from "supertest";
import { createE2eApp, destroyE2eApp, type E2eTestContext } from "./helpers";

describe("Feature discovery configuration (e2e)", () => {
	let ctx: E2eTestContext;

	beforeAll(async () => {
		ctx = await createE2eApp({ withGlobalPrefix: true });
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
});
