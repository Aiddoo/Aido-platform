import { envSchema } from ".";

const requiredEnvironment = {
	DATABASE_URL: "postgresql://localhost:5432/aido",
	JWT_SECRET: "a".repeat(32),
	JWT_REFRESH_SECRET: "b".repeat(32),
	TOKEN_ENCRYPTION_KEY: "c".repeat(32),
};

describe("feature discovery environment configuration", () => {
	it("defaults to disabled when no feature-discovery variables are set", () => {
		// Given / When
		const result = envSchema.parse(requiredEnvironment);

		// Then - an unset rollout must fail closed without companion variables
		expect(result.FEATURE_DISCOVERY_ENABLED).toBe(false);
		expect(result.FEATURE_DISCOVERY_CAMPAIGN_ID).toBeUndefined();
		expect(result.FEATURE_DISCOVERY_MIN_APP_VERSION).toBeUndefined();
		expect(result.FEATURE_DISCOVERY_LAUNCHED_AT).toBeUndefined();
		expect(result.FEATURE_DISCOVERY_AUTO_OPEN).toBe(true);
	});

	it("rejects an enabled rollout without its campaign configuration", () => {
		// Given / When
		const result = envSchema.safeParse({
			...requiredEnvironment,
			FEATURE_DISCOVERY_ENABLED: "true",
		});

		// Then - enabled is never allowed to expose an incomplete campaign
		expect(result.success).toBe(false);
	});

	it("validates all enabled campaign values and defaults auto-open to true", () => {
		// Given / When
		const result = envSchema.parse({
			...requiredEnvironment,
			FEATURE_DISCOVERY_ENABLED: "true",
			FEATURE_DISCOVERY_CAMPAIGN_ID: "feature-discovery-2026-08",
			FEATURE_DISCOVERY_MIN_APP_VERSION: "1.8.0",
			FEATURE_DISCOVERY_LAUNCHED_AT: "2026-08-01T00:00:00.000Z",
		});

		// Then
		expect(result.FEATURE_DISCOVERY_AUTO_OPEN).toBe(true);
	});

	it("rejects enabled campaigns with malformed version or launch timestamp", () => {
		// Given / When
		const result = envSchema.safeParse({
			...requiredEnvironment,
			FEATURE_DISCOVERY_ENABLED: "true",
			FEATURE_DISCOVERY_CAMPAIGN_ID: "feature-discovery-2026-08",
			FEATURE_DISCOVERY_MIN_APP_VERSION: "1.8",
			FEATURE_DISCOVERY_LAUNCHED_AT: "August 1st",
		});

		// Then
		expect(result.success).toBe(false);
	});
});
