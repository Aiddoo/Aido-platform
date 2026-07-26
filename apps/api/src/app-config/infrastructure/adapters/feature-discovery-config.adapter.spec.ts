import { TestBed } from "@suites/unit";
import { TypedConfigService } from "@/shared/infrastructure/config/services/config.service";
import { FeatureDiscoveryConfigAdapter } from "./feature-discovery-config.adapter";

describe("FeatureDiscoveryConfigAdapter — environment kill switch", () => {
	it("fails closed when enabled configuration is incomplete", async () => {
		// Given - a malformed config source bypassing startup validation
		const { unit } = await TestBed.solitary(FeatureDiscoveryConfigAdapter)
			.mock(TypedConfigService)
			.impl(() => ({
				featureDiscovery: {
					enabled: true,
					campaignId: undefined,
					minAppVersion: "1.8.0",
					launchedAt: "2026-08-01T00:00:00.000Z",
					autoOpen: true,
				},
			}))
			.compile();

		// When
		const result = unit.getFeatureDiscovery();

		// Then
		expect(result).toEqual({ enabled: false });
	});

	it("exposes the configured campaign metadata without copy or user data", async () => {
		// Given
		const { unit } = await TestBed.solitary(FeatureDiscoveryConfigAdapter)
			.mock(TypedConfigService)
			.impl(() => ({
				featureDiscovery: {
					enabled: true,
					campaignId: "feature-discovery-2026-08",
					minAppVersion: "1.8.0",
					launchedAt: "2026-08-01T00:00:00.000Z",
					autoOpen: true,
				},
			}))
			.compile();

		// When
		const result = unit.getFeatureDiscovery();

		// Then
		expect(result).toEqual({
			enabled: true,
			campaignId: "feature-discovery-2026-08",
			minAppVersion: "1.8.0",
			launchedAt: "2026-08-01T00:00:00.000Z",
			autoOpen: true,
		});
	});
});
