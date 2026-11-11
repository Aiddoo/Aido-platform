import type { ConfigType } from "@nestjs/config";

import { defineConfig } from "#api/platform/config/define-config";
import { featureDiscoverySchema } from "#api/platform/config/schemas/feature-discovery.schema";

export const appConfigFeatureDiscoveryConfig = defineConfig(
  "appConfigFeatureDiscovery",
  featureDiscoverySchema.transform((env) => ({
    enabled: env.FEATURE_DISCOVERY_ENABLED,
    campaignId: env.FEATURE_DISCOVERY_CAMPAIGN_ID,
    minAppVersion: env.FEATURE_DISCOVERY_MIN_APP_VERSION,
    launchedAt: env.FEATURE_DISCOVERY_LAUNCHED_AT,
    autoOpen: env.FEATURE_DISCOVERY_AUTO_OPEN,
  })),
  (env) => ({
    FEATURE_DISCOVERY_ENABLED: env.FEATURE_DISCOVERY_ENABLED,
    FEATURE_DISCOVERY_CAMPAIGN_ID: env.FEATURE_DISCOVERY_CAMPAIGN_ID,
    FEATURE_DISCOVERY_MIN_APP_VERSION: env.FEATURE_DISCOVERY_MIN_APP_VERSION,
    FEATURE_DISCOVERY_LAUNCHED_AT: env.FEATURE_DISCOVERY_LAUNCHED_AT,
    FEATURE_DISCOVERY_AUTO_OPEN: env.FEATURE_DISCOVERY_AUTO_OPEN,
  }),
);

export type AppConfigFeatureDiscoveryConfig = ConfigType<typeof appConfigFeatureDiscoveryConfig>;
