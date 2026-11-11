import type { PushCampaignOutcome } from "#api/modules/notification/notification-delivery.public";

import type { BroadcastCampaignId } from "../../domain/broadcast-campaign-id.vo.js";
import type { BroadcastCampaign } from "../../domain/broadcast-campaign.aggregate.js";
import { broadcastCampaignNotFound } from "../broadcasts.errors.js";
import type { BroadcastCampaignRepositoryPort } from "../ports/broadcast-campaign.repository.port.js";
import type { BroadcastDeliveryOutcomeReaderPort } from "../ports/broadcast-delivery-outcome.reader.port.js";

export interface GetBroadcastCampaignQuery {
  readonly campaignId: BroadcastCampaignId;
}

export interface GetBroadcastCampaignResult {
  readonly campaign: BroadcastCampaign;
  readonly outcome: PushCampaignOutcome;
}

export interface GetBroadcastCampaignDependencies {
  readonly campaignRepository: Pick<BroadcastCampaignRepositoryPort, "findById">;
  readonly outcomeReader: Pick<BroadcastDeliveryOutcomeReaderPort, "summarize">;
}

export class GetBroadcastCampaignUseCase {
  readonly #dependencies: GetBroadcastCampaignDependencies;

  constructor(dependencies: GetBroadcastCampaignDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(query: GetBroadcastCampaignQuery): Promise<GetBroadcastCampaignResult> {
    const { campaignRepository, outcomeReader } = this.#dependencies;
    const campaign = await campaignRepository.findById(query.campaignId);
    if (campaign == null) {
      throw broadcastCampaignNotFound(query.campaignId.value);
    }
    const outcome = await outcomeReader.summarize(campaign.campaignKey);
    return { campaign, outcome };
  }
}
