import type { Provider } from "@nestjs/common";

import { provideUseCase } from "#api/platform/di/provide-use-case";

import { FeatureDiscoveryCampaignReaderPort } from "./application/ports/feature-discovery-campaign.reader.port.js";
import { GetFeatureDiscoveryUseCase } from "./application/use-cases/get-feature-discovery.use-case.js";
import { EnvironmentFeatureDiscoveryCampaignAdapter } from "./infrastructure/adapters/environment-feature-discovery-campaign.adapter.js";

export const APP_CONFIG_FEATURE_DISCOVERY_PROVIDERS = [
  {
    provide: FeatureDiscoveryCampaignReaderPort,
    useClass: EnvironmentFeatureDiscoveryCampaignAdapter,
  },
  provideUseCase(GetFeatureDiscoveryUseCase, {
    campaignReader: FeatureDiscoveryCampaignReaderPort,
  }),
] satisfies Provider[];
