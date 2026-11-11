import { Inject, Injectable } from "@nestjs/common";

import {
  type PushCampaignOutcome,
  PushCampaignOutcomeReaderPort,
} from "#api/modules/notification/notification-delivery.public";

import { BroadcastDeliveryOutcomeReaderPort } from "../../application/ports/broadcast-delivery-outcome.reader.port.js";

@Injectable()
export class NotificationBroadcastDeliveryOutcomeAdapter extends BroadcastDeliveryOutcomeReaderPort {
  readonly #reader: PushCampaignOutcomeReaderPort;

  constructor(@Inject(PushCampaignOutcomeReaderPort) reader: PushCampaignOutcomeReaderPort) {
    super();
    this.#reader = reader;
  }

  summarize(campaignKey: string): Promise<PushCampaignOutcome> {
    return this.#reader.summarize(campaignKey);
  }
}
