import type { FeatureDiscoveryCampaign } from "../../domain/feature-discovery-campaign.aggregate.js";
import type { FeatureDiscoveryCampaignRepositoryPort } from "../ports/feature-discovery-campaign.repository.port.js";

export interface GetFeatureDiscoveryCampaignDependencies {
  readonly campaignRepository: Pick<FeatureDiscoveryCampaignRepositoryPort, "findActiveCampaign">;
}

export class GetFeatureDiscoveryCampaignUseCase {
  readonly #dependencies: GetFeatureDiscoveryCampaignDependencies;

  constructor(dependencies: GetFeatureDiscoveryCampaignDependencies) {
    this.#dependencies = dependencies;
  }

  execute(): FeatureDiscoveryCampaign | null {
    return this.#dependencies.campaignRepository.findActiveCampaign();
  }
}
