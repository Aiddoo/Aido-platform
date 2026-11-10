import { FeatureDiscoveryCampaignReaderPort } from "#api/modules/app-config/feature-discovery/application/ports/feature-discovery-campaign.reader.port";
import type { FeatureDiscoveryCampaign } from "#api/modules/app-config/feature-discovery/domain/feature-discovery-campaign.entity";

export class InMemoryFeatureDiscoveryCampaignReader extends FeatureDiscoveryCampaignReaderPort {
  campaign: FeatureDiscoveryCampaign | null;

  constructor(campaign: FeatureDiscoveryCampaign | null = null) {
    super();
    this.campaign = campaign;
  }

  findActiveCampaign(): FeatureDiscoveryCampaign | null {
    return this.campaign;
  }
}
