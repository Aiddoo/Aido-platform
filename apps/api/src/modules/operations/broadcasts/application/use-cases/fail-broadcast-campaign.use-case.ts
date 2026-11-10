import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/index";

import { OperationsAdminLogEvent } from "../broadcasts.log-events.js";
import type { BroadcastCampaignRepositoryPort } from "../ports/broadcast-campaign.repository.port.js";

export const BROADCAST_FAN_OUT_EXHAUSTED_REASON = "FAN_OUT_RETRIES_EXHAUSTED";

interface FailBroadcastCampaignDependencies {
  readonly repository: Pick<BroadcastCampaignRepositoryPort, "findByIdForUpdate" | "save">;
  readonly unitOfWork: Pick<UnitOfWorkPort, "run">;
  readonly logger: Pick<ApplicationLoggerPort, "error">;
}

/** 분배 작업이 재시도를 다 쓰면 캠페인을 실패로 닫는다. 이미 끝난 캠페인은 바꾸지 않는다. */
export class FailBroadcastCampaign {
  readonly #dependencies: FailBroadcastCampaignDependencies;

  constructor(dependencies: FailBroadcastCampaignDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: { readonly campaignId: string }): Promise<boolean> {
    const failed = await this.#dependencies.unitOfWork.run(async () => {
      const campaign = await this.#dependencies.repository.findByIdForUpdate(input.campaignId);
      if (campaign == null || !campaign.fail(BROADCAST_FAN_OUT_EXHAUSTED_REASON, new Date())) {
        return false;
      }
      await this.#dependencies.repository.save(campaign);
      return true;
    });
    if (failed) {
      this.#dependencies.logger.error({
        event: OperationsAdminLogEvent.BROADCAST_FAILED,
        campaignId: input.campaignId,
        reason: BROADCAST_FAN_OUT_EXHAUSTED_REASON,
      });
    }
    return failed;
  }
}
