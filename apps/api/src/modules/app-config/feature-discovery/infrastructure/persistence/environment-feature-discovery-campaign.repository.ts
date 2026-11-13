import { Inject, Injectable } from "@nestjs/common";

import {
  type AppConfigFeatureDiscoveryConfig,
  appConfigFeatureDiscoveryConfig,
} from "../../app-config-feature-discovery.config.js";
import { FeatureDiscoveryCampaignRepositoryPort } from "../../application/ports/feature-discovery-campaign.repository.port.js";
import type { FeatureDiscoveryCampaign } from "../../domain/feature-discovery-campaign.aggregate.js";
import { toFeatureDiscoveryCampaign } from "./feature-discovery-campaign-env.mapper.js";

@Injectable()
export class EnvironmentFeatureDiscoveryCampaignRepository extends FeatureDiscoveryCampaignRepositoryPort {
  readonly #config: AppConfigFeatureDiscoveryConfig;

  constructor(
    @Inject(appConfigFeatureDiscoveryConfig.KEY) config: AppConfigFeatureDiscoveryConfig,
  ) {
    super();
    this.#config = config;
  }

  findActiveCampaign(): FeatureDiscoveryCampaign | null {
    return toFeatureDiscoveryCampaign(this.#config);
  }
}
