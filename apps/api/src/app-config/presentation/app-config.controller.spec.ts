import { Test } from "@nestjs/testing";
import { AppConfigFacade } from "../application/facades/app-config.facade";
import { AppConfigController } from "./app-config.controller";

describe("AppConfigController — feature discovery endpoint", () => {
	it("returns the public campaign configuration from the facade", async () => {
		// Given
		const module = await Test.createTestingModule({
			controllers: [AppConfigController],
			providers: [
				{
					provide: AppConfigFacade,
					useValue: {
						getFeatureDiscovery: () => ({ enabled: false }),
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
