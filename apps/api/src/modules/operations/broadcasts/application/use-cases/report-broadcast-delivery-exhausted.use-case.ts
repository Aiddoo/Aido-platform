import type { OperationalAlertPort } from "#api/shared/application/ports/operational-alert.port";

import type { BroadcastCampaignId } from "../../domain/broadcast-campaign-id.vo.js";
import { BroadcastAlerts } from "../broadcasts.alerts.js";

export interface ReportBroadcastDeliveryExhaustedCommand {
  readonly campaignId: BroadcastCampaignId;
  readonly recipientCount: number;
}

export interface ReportBroadcastDeliveryExhaustedDependencies {
  readonly alert: Pick<OperationalAlertPort, "raise">;
}

/** 현지 시각 발송 묶음이 재시도를 다 쓰면 운영자가 알 수 있게 경보만 올린다(사용자 ID는 싣지 않는다). */
export class ReportBroadcastDeliveryExhaustedUseCase {
  readonly #dependencies: ReportBroadcastDeliveryExhaustedDependencies;

  constructor(dependencies: ReportBroadcastDeliveryExhaustedDependencies) {
    this.#dependencies = dependencies;
  }

  execute(command: ReportBroadcastDeliveryExhaustedCommand): void {
    this.#dependencies.alert.raise({
      ...BroadcastAlerts.DELIVERY_EXHAUSTED,
      tags: { campaignId: command.campaignId.value },
      details: { recipientCount: command.recipientCount },
    });
  }
}
