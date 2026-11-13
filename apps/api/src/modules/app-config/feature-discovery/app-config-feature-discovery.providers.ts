import type { Provider } from "@nestjs/common";

import { provideUseCase } from "#api/platform/di/provide-use-case";

import { FeatureDiscoveryCampaignRepositoryPort } from "./application/ports/feature-discovery-campaign.repository.port.js";
import { GetFeatureDiscoveryCampaignUseCase } from "./application/use-cases/get-feature-discovery-campaign.use-case.js";
import { EnvironmentFeatureDiscoveryCampaignRepository } from "./infrastructure/persistence/environment-feature-discovery-campaign.repository.js";

export const APP_CONFIG_FEATURE_DISCOVERY_PROVIDERS = [
  {
    provide: FeatureDiscoveryCampaignRepositoryPort,
    useClass: EnvironmentFeatureDiscoveryCampaignRepository,
  },
  provideUseCase(GetFeatureDiscoveryCampaignUseCase, {
    campaignRepository: FeatureDiscoveryCampaignRepositoryPort,
  }),
] satisfies Provider[];
