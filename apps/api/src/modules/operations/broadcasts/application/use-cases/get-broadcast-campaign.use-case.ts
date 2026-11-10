import { ErrorCode } from "@aido/api/errors";

import type { PushCampaignOutcome } from "#api/modules/notification/notification-delivery.public";
import { ApplicationException } from "#api/shared/application/application.exception";

import type { BroadcastCampaign } from "../../domain/broadcast-campaign.aggregate.js";
import type { BroadcastCampaignRepositoryPort } from "../ports/broadcast-campaign.repository.port.js";
import type { BroadcastDeliveryOutcomeReaderPort } from "../ports/broadcast-delivery-outcome.reader.port.js";

export interface GetBroadcastCampaignResult {
  readonly campaign: BroadcastCampaign;
  readonly outcome: PushCampaignOutcome;
}

interface GetBroadcastCampaignDependencies {
  readonly repository: Pick<BroadcastCampaignRepositoryPort, "findById">;
  readonly outcomeReader: Pick<BroadcastDeliveryOutcomeReaderPort, "summarize">;
}

export class GetBroadcastCampaign {
  readonly #dependencies: GetBroadcastCampaignDependencies;

  constructor(dependencies: GetBroadcastCampaignDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: { readonly campaignId: string }): Promise<GetBroadcastCampaignResult> {
    const campaign = await this.#dependencies.repository.findById(input.campaignId);
    if (campaign == null) {
      throw new ApplicationException(ErrorCode.ADMIN_1404, { campaignId: input.campaignId });
    }
    const outcome = await this.#dependencies.outcomeReader.summarize(campaign.campaignKey);
    return { campaign, outcome };
  }
}
