import { TestBed } from "@suites/unit";

import {
	FEATURE_DISCOVERY_CONFIG,
	type FeatureDiscoveryConfigPort,
} from "../../ports/feature-discovery-config.port";
import { GetFeatureDiscoveryUseCase } from "./get-feature-discovery.use-case";

describe("GetFeatureDiscoveryUseCase — feature discovery configuration", () => {
	it("returns the fail-closed configuration supplied by the port", async () => {
		// Given
		const { unit } = await TestBed.solitary(GetFeatureDiscoveryUseCase)
			.mock<FeatureDiscoveryConfigPort>(FEATURE_DISCOVERY_CONFIG)
			.impl(() => ({ getFeatureDiscovery: () => ({ enabled: false }) }))
			.compile();

		// When
		const result = unit.execute();

		// Then - a kill switch never needs request or user data
		expect(result).toEqual({ enabled: false });
	});
});
