import { z } from "zod";

const semverPattern =
	/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

/**
 * Public feature-discovery rollout configuration.
 *
 * Disabled is the safe default. Campaign fields become required only when the
 * rollout is enabled, so an unset kill switch never blocks application startup.
 */
export const featureDiscoverySchema = z.object({
	FEATURE_DISCOVERY_ENABLED: z.stringbool().default(false),
	FEATURE_DISCOVERY_CAMPAIGN_ID: z.string().optional(),
	FEATURE_DISCOVERY_MIN_APP_VERSION: z.string().optional(),
	FEATURE_DISCOVERY_LAUNCHED_AT: z.string().optional(),
	FEATURE_DISCOVERY_AUTO_OPEN: z.stringbool().default(true),
});

export function validateFeatureDiscoveryConfig(
	config: FeatureDiscoveryConfig,
	context: z.RefinementCtx,
): void {
	if (!config.FEATURE_DISCOVERY_ENABLED) {
		return;
	}

	if (!config.FEATURE_DISCOVERY_CAMPAIGN_ID?.trim()) {
		context.addIssue({
			code: "custom",
			path: ["FEATURE_DISCOVERY_CAMPAIGN_ID"],
			message: "FEATURE_DISCOVERY_CAMPAIGN_ID is required when FEATURE_DISCOVERY_ENABLED is true",
		});
	}

	if (
		!config.FEATURE_DISCOVERY_MIN_APP_VERSION ||
		!semverPattern.test(config.FEATURE_DISCOVERY_MIN_APP_VERSION)
	) {
		context.addIssue({
			code: "custom",
			path: ["FEATURE_DISCOVERY_MIN_APP_VERSION"],
			message:
				"FEATURE_DISCOVERY_MIN_APP_VERSION must be a semantic version when FEATURE_DISCOVERY_ENABLED is true",
		});
	}

	if (
		!config.FEATURE_DISCOVERY_LAUNCHED_AT ||
		!z.iso.datetime().safeParse(config.FEATURE_DISCOVERY_LAUNCHED_AT).success
	) {
		context.addIssue({
			code: "custom",
			path: ["FEATURE_DISCOVERY_LAUNCHED_AT"],
			message:
				"FEATURE_DISCOVERY_LAUNCHED_AT must be an ISO datetime when FEATURE_DISCOVERY_ENABLED is true",
		});
	}
}

export type FeatureDiscoveryConfig = z.infer<typeof featureDiscoverySchema>;
