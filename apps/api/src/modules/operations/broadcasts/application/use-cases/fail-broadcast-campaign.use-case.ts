import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

import type { BroadcastCampaignId } from "../../domain/broadcast-campaign-id.vo.js";
import { BroadcastLogEvent } from "../broadcasts.log-events.js";
import type { BroadcastCampaignRepositoryPort } from "../ports/broadcast-campaign.repository.port.js";

const BROADCAST_FAN_OUT_EXHAUSTED_REASON = "FAN_OUT_RETRIES_EXHAUSTED";

export interface FailBroadcastCampaignCommand {
  readonly campaignId: BroadcastCampaignId;
}

export interface FailBroadcastCampaignDependencies {
  readonly unitOfWork: Pick<UnitOfWorkPort, "run">;
  readonly campaignRepository: Pick<BroadcastCampaignRepositoryPort, "findByIdForUpdate" | "save">;
  readonly clock: ClockPort;
  readonly logger: Pick<ApplicationLoggerPort, "error">;
}

/** 분배 작업이 재시도를 다 쓰면 캠페인을 실패로 닫는다. 이미 끝난 캠페인은 바꾸지 않는다. */
export class FailBroadcastCampaignUseCase {
  readonly #dependencies: FailBroadcastCampaignDependencies;

  constructor(dependencies: FailBroadcastCampaignDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: FailBroadcastCampaignCommand): Promise<boolean> {
    const { unitOfWork, campaignRepository, clock, logger } = this.#dependencies;
    const failed = await unitOfWork.run(async () => {
      const campaign = await campaignRepository.findByIdForUpdate(command.campaignId);
      if (campaign == null || !campaign.fail(BROADCAST_FAN_OUT_EXHAUSTED_REASON, clock.now())) {
        return false;
      }
      await campaignRepository.save(campaign);
      return true;
    });
    if (failed) {
      logger.error({
        event: BroadcastLogEvent.BROADCAST_FAILED,
        campaignId: command.campaignId.value,
        reason: BROADCAST_FAN_OUT_EXHAUSTED_REASON,
      });
    }
    return failed;
  }
}
