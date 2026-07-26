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
});
