import { FeatureDiscoveryCampaignRepositoryPort } from "#api/modules/app-config/feature-discovery/application/ports/feature-discovery-campaign.repository.port";
import type { FeatureDiscoveryCampaign } from "#api/modules/app-config/feature-discovery/domain/feature-discovery-campaign.aggregate";

export class InMemoryFeatureDiscoveryCampaignRepository extends FeatureDiscoveryCampaignRepositoryPort {
  campaign: FeatureDiscoveryCampaign | null;

  constructor(campaign: FeatureDiscoveryCampaign | null = null) {
    super();
    this.campaign = campaign;
  }

  findActiveCampaign(): FeatureDiscoveryCampaign | null {
    return this.campaign;
  }
}
