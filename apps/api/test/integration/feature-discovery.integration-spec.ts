import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import type { App } from "supertest/types";
import { AppConfigModule } from "@/app-config";
import { FeatureDiscoveryConfigAdapter } from "@/app-config/infrastructure/adapters/feature-discovery-config.adapter";

describe("Feature discovery configuration route (integration)", () => {
	let app: INestApplication<App>;

	beforeAll(async () => {
		const module = await Test.createTestingModule({
			imports: [AppConfigModule],
		})
			.overrideProvider(FeatureDiscoveryConfigAdapter)
			.useValue({ getFeatureDiscovery: () => ({ enabled: false }) })
			.compile();

		app = module.createNestApplication();
		app.setGlobalPrefix("v1");
		await app.init();
	});

	afterAll(async () => {
		await app.close();
	});

	it("serves a public, five-minute-cacheable fail-closed response", async () => {
		// When
		const response = await request(app.getHttpServer())
			.get("/v1/app-config/feature-discovery")
			.expect(200);

		// Then - no authorization, user data, or campaign copy is involved
		expect(response.headers["cache-control"]).toBe("public, max-age=300");
		expect(response.body).toEqual({ enabled: false });
	});
});
