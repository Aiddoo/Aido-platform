import type { FeatureDiscoveryCampaign } from "../../domain/feature-discovery-campaign.entity.js";
import type { FeatureDiscoveryCampaignReaderPort } from "../ports/feature-discovery-campaign.reader.port.js";

export interface GetFeatureDiscoveryDependencies {
  readonly campaignReader: Pick<FeatureDiscoveryCampaignReaderPort, "findActiveCampaign">;
}

export class GetFeatureDiscoveryUseCase {
  readonly #dependencies: GetFeatureDiscoveryDependencies;

  constructor(dependencies: GetFeatureDiscoveryDependencies) {
    this.#dependencies = dependencies;
  }

  execute(): FeatureDiscoveryCampaign | null {
    return this.#dependencies.campaignReader.findActiveCampaign();
  }
}
