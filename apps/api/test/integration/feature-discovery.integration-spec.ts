import type { INestApplication } from "@nestjs/common";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
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

	it("serves a non-cacheable fail-closed response", async () => {
		// When
		const response = await request(app.getHttpServer())
			.get("/v1/app-config/feature-discovery")
			.expect(200);

		// Then - no authorization, user data, or campaign copy is involved
		expect(response.headers["cache-control"]).toBe("private, no-store");
		expect(response.body).toEqual({ enabled: false });
	});

	it("documents the raw discriminated union and cache response header", () => {
		// When
		const document = SwaggerModule.createDocument(
			app,
			new DocumentBuilder().setTitle("Aido API").build(),
		);
		const response = document.paths["/v1/app-config/feature-discovery"]?.get?.responses?.["200"];

		// Then - the endpoint contract is raw (not the ordinary success wrapper)
		expect(response).toMatchObject({
			headers: {
				"Cache-Control": {
					schema: { type: "string" },
				},
			},
			content: {
				"application/json": {
					schema: {
						oneOf: [
							{
								type: "object",
								additionalProperties: false,
								required: ["enabled"],
								properties: { enabled: { enum: [false] } },
							},
							{
								type: "object",
								additionalProperties: false,
								required: ["enabled", "campaignId", "minAppVersion", "launchedAt", "autoOpen"],
								properties: {
									enabled: { enum: [true] },
									minAppVersion: { pattern: expect.any(String) },
									launchedAt: {
										format: "date-time",
										pattern: expect.any(String),
									},
								},
							},
						],
						discriminator: { propertyName: "enabled" },
					},
				},
			},
		});
	});
});
