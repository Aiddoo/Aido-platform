import { Inject, Injectable } from "@nestjs/common";

import {
  type AppConfigFeatureDiscoveryCampaignsConfig,
  appConfigFeatureDiscoveryCampaignsConfig,
} from "../../app-config-feature-discovery-campaigns.config.js";
import { FeatureDiscoveryCampaignRepositoryPort } from "../../application/ports/feature-discovery-campaign.repository.port.js";
import type { FeatureDiscoveryCampaign } from "../../domain/feature-discovery-campaign.aggregate.js";
import { toFeatureDiscoveryCampaign } from "./feature-discovery-campaign-env.mapper.js";

@Injectable()
export class EnvironmentFeatureDiscoveryCampaignRepository implements FeatureDiscoveryCampaignRepositoryPort {
  readonly #config: AppConfigFeatureDiscoveryCampaignsConfig;

  constructor(
    @Inject(appConfigFeatureDiscoveryCampaignsConfig.KEY)
    config: AppConfigFeatureDiscoveryCampaignsConfig,
  ) {
    this.#config = config;
  }

  findActiveCampaign(): FeatureDiscoveryCampaign | null {
    return toFeatureDiscoveryCampaign(this.#config);
  }
}
