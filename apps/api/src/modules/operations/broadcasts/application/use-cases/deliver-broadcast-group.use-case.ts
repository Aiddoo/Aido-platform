import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { BroadcastCampaignId } from "../../domain/broadcast-campaign-id.vo.js";
import { BroadcastLogEvent } from "../broadcasts.log-events.js";
import { buildCampaignMessages } from "../messages/broadcast-message.messages.js";
import type { AdminBroadcastNotifierPort } from "../ports/admin-broadcast-notifier.port.js";
import type { BroadcastCampaignRepositoryPort } from "../ports/broadcast-campaign.repository.port.js";
import type { BroadcastRecipientReaderPort } from "../ports/broadcast-recipient.reader.port.js";

export interface DeliverBroadcastGroupCommand {
  readonly campaignId: BroadcastCampaignId;
  readonly userIds: readonly UserId[];
}

export interface DeliverBroadcastGroupDependencies {
  readonly unitOfWork: Pick<UnitOfWorkPort, "run">;
  readonly campaignRepository: Pick<BroadcastCampaignRepositoryPort, "findById">;
  readonly recipientReader: Pick<BroadcastRecipientReaderPort, "listRecipients">;
  readonly notifier: Pick<AdminBroadcastNotifierPort, "sendBatch">;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

/**
 * 수신자 현지 시각이 된 묶음의 알림을 만든다. 알림 행·발송 outbox는 한 transaction이고
 * 공급자 발송은 push-delivery 작업이 commit 뒤 처리한다. 캠페인이 사라졌으면 건너뛴다.
 */
export class DeliverBroadcastGroupUseCase {
  readonly #dependencies: DeliverBroadcastGroupDependencies;

  constructor(dependencies: DeliverBroadcastGroupDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: DeliverBroadcastGroupCommand): Promise<void> {
    const { unitOfWork, campaignRepository, recipientReader, notifier, logger } =
      this.#dependencies;
    const campaign = await campaignRepository.findById(command.campaignId);
    if (campaign == null) {
      logger.log({
        event: BroadcastLogEvent.DELIVERY_SKIPPED,
        campaignId: command.campaignId.value,
        reason: "campaign-not-found",
      });
      return;
    }

    const recipients = await recipientReader.listRecipients(command.userIds);
    const messages = buildCampaignMessages({ campaign, userIds: command.userIds, recipients });
    const { count } = await unitOfWork.run(() => notifier.sendBatch(messages));
    logger.log({
      event: BroadcastLogEvent.DELIVERY_SENT,
      campaignId: command.campaignId.value,
      recipientCount: command.userIds.length,
      queuedCount: count,
    });
  }
}
