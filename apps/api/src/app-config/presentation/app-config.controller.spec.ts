import { Test } from "@nestjs/testing";
import { GetFeatureDiscoveryUseCase } from "../application/queries/get-feature-discovery/get-feature-discovery.use-case";
import { AppConfigController } from "./app-config.controller";

describe("AppConfigController — feature discovery endpoint", () => {
	it("returns the public campaign configuration from the use case", async () => {
		// Given
		const module = await Test.createTestingModule({
			controllers: [AppConfigController],
			providers: [
				{
					provide: GetFeatureDiscoveryUseCase,
					useValue: {
						execute: () => ({ enabled: false }),
					},
				},
			],
		}).compile();
		const controller = module.get(AppConfigController);

		// When
		const result = controller.getFeatureDiscovery();

		// Then
		expect(result).toEqual({ enabled: false });
		await module.close();
	});
});
