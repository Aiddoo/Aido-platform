import { featureDiscoveryResponseSchema } from "@aido/validators";

describe("feature discovery response contract", () => {
	it("rejects incomplete enabled and leaking disabled variants", () => {
		// Then - a client can only receive one complete discriminated-union shape
		expect(
			featureDiscoveryResponseSchema.safeParse({ enabled: true }).success,
		).toBe(false);
		expect(
			featureDiscoveryResponseSchema.safeParse({
				enabled: false,
				campaignId: "feature-discovery-2026-08",
			}).success,
		).toBe(false);
	});

	it("rejects non-semver versions and offset launch datetimes", () => {
		// Then - client contracts match the rollout validator's strict format rules
		expect(
			featureDiscoveryResponseSchema.safeParse({
				enabled: true,
				campaignId: "feature-discovery-2026-08",
				minAppVersion: "1.8",
				launchedAt: "2026-08-01T00:00:00.000Z",
				autoOpen: true,
			}).success,
		).toBe(false);
		expect(
			featureDiscoveryResponseSchema.safeParse({
				enabled: true,
				campaignId: "feature-discovery-2026-08",
				minAppVersion: "1.8.0",
				launchedAt: "2026-08-01T09:00:00.000+09:00",
				autoOpen: true,
			}).success,
		).toBe(false);
	});
});
