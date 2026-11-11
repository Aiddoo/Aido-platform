import { groupBy } from "es-toolkit";

import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { BroadcastCampaignId } from "../../domain/broadcast-campaign-id.vo.js";
import type { BroadcastCampaign } from "../../domain/broadcast-campaign.aggregate.js";
import { resolveRecipientStartAfter } from "../../domain/broadcast-delivery.domain-service.js";
import {
  BROADCAST_FAN_OUT_PAGE_SIZE,
  BROADCAST_FAN_OUT_RUN_BUDGET_MS,
} from "../../domain/broadcasts.constants.js";
import { BroadcastLogEvent } from "../broadcasts.log-events.js";
import { buildCampaignMessages } from "../messages/broadcast-message.messages.js";
import type { AdminBroadcastNotifierPort } from "../ports/admin-broadcast-notifier.port.js";
import type { AdminUserDirectoryReaderPort } from "../ports/admin-user-directory.reader.port.js";
import type { BroadcastCampaignRepositoryPort } from "../ports/broadcast-campaign.repository.port.js";
import type { BroadcastJobEnqueuerPort } from "../ports/broadcast-job-enqueuer.port.js";
import type { BroadcastRecipientReaderPort } from "../ports/broadcast-recipient.reader.port.js";

type PageOutcome =
  | { readonly status: "done" }
  | { readonly status: "more"; readonly cursorUserId: UserId };

export interface FanOutBroadcastCampaignCommand {
  readonly campaignId: BroadcastCampaignId;
}

export interface FanOutBroadcastCampaignDependencies {
  readonly unitOfWork: Pick<UnitOfWorkPort, "run">;
  readonly campaignRepository: Pick<BroadcastCampaignRepositoryPort, "findByIdForUpdate" | "save">;
  readonly userDirectory: Pick<AdminUserDirectoryReaderPort, "listTargetUserIdsAfter">;
  readonly recipientReader: Pick<BroadcastRecipientReaderPort, "listRecipients">;
  readonly notifier: Pick<AdminBroadcastNotifierPort, "sendBatch">;
  readonly jobEnqueuer: Pick<BroadcastJobEnqueuerPort, "enqueueFanOut" | "enqueueDelivery">;
  readonly clock: ClockPort;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

/**
 * 대상 사용자를 cursor 순서로 나눠 알림과 발송 outbox를 만든다. 페이지 저장과 cursor 전진이 한
 * transaction이라 작업이 중간에 죽어도 다음 실행이 마지막으로 커밋된 cursor부터 이어 간다.
 * 공급자 발송은 push-delivery 작업이 commit 뒤 따로 처리하므로 이 transaction은 DB 쓰기만 한다.
 * 수신자 현지 시각 발송은 알림을 바로 만들지 않고 시각별 발송 작업을 같은 transaction에 등록한다.
 */
export class FanOutBroadcastCampaignUseCase {
  readonly #dependencies: FanOutBroadcastCampaignDependencies;

  constructor(dependencies: FanOutBroadcastCampaignDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: FanOutBroadcastCampaignCommand): Promise<void> {
    const { unitOfWork, jobEnqueuer, clock, logger } = this.#dependencies;
    const deadline = clock.now().add({ milliseconds: BROADCAST_FAN_OUT_RUN_BUDGET_MS });
    for (;;) {
      const outcome = await unitOfWork.run(() => this.#fanOutPage(command.campaignId));
      if (outcome.status === "done") {
        return;
      }
      if (Temporal.Instant.compare(clock.now(), deadline) >= 0) {
        await jobEnqueuer.enqueueFanOut({
          campaignId: command.campaignId,
          cursorUserId: outcome.cursorUserId,
        });
        logger.log({
          event: BroadcastLogEvent.BROADCAST_CONTINUED,
          campaignId: command.campaignId.value,
        });
        return;
      }
    }
  }

  async #fanOutPage(campaignId: BroadcastCampaignId): Promise<PageOutcome> {
    const { campaignRepository, userDirectory, clock, logger } = this.#dependencies;
    const campaign = await campaignRepository.findByIdForUpdate(campaignId);
    if (campaign == null || campaign.isTerminal()) {
      return { status: "done" };
    }
    const now = clock.now();
    campaign.start(now);
    const userIds = await userDirectory.listTargetUserIdsAfter({
      filter: campaign.targetFilter,
      cursorUserId: campaign.cursorUserId,
      limit: BROADCAST_FAN_OUT_PAGE_SIZE,
    });
    const lastUserId = userIds.at(-1);
    if (lastUserId != null) {
      const queuedCount = await this.#queuePage(campaign, userIds, now);
      campaign.recordPage({ lastUserId, processedCount: userIds.length, queuedCount }, now);
    }
    const isLastPage = userIds.length < BROADCAST_FAN_OUT_PAGE_SIZE;
    if (isLastPage) {
      campaign.complete(now);
    }
    await campaignRepository.save(campaign);
    if (isLastPage || lastUserId == null) {
      logger.log({
        event: BroadcastLogEvent.BROADCAST_COMPLETED,
        campaignId: campaignId.value,
        processedCount: campaign.processedCount,
        queuedCount: campaign.queuedCount,
      });
      return { status: "done" };
    }
    return { status: "more", cursorUserId: lastUserId };
  }

  // 지금 보내면 알림을 만들고, 수신자 현지 시각이면 시각별 발송 작업을 등록한다. 반환은 올린 수신자 수다
  async #queuePage(
    campaign: BroadcastCampaign,
    userIds: readonly UserId[],
    now: Temporal.Instant,
  ): Promise<number> {
    const { recipientReader, notifier } = this.#dependencies;
    const recipients = await recipientReader.listRecipients(userIds);

    if (campaign.delivery.value.mode === "NOW") {
      const { count } = await notifier.sendBatch(
        buildCampaignMessages({ campaign, userIds, recipients }),
      );
      return count;
    }

    const groups = groupBy(userIds, (userId) => {
      const recipient = recipients.get(userId.value);
      const startAfter =
        recipient == null
          ? null
          : resolveRecipientStartAfter({
              delivery: campaign.delivery,
              timeZone: recipient.timeZone,
              now,
            });
      return startAfter == null ? now.toString() : startAfter.toString();
    });
    const schedules = Object.entries(groups)
      .map(([startAfter, groupUserIds]) => ({
        startAfter: Temporal.Instant.from(startAfter),
        userIds: groupUserIds,
      }))
      .toSorted((left, right) => Temporal.Instant.compare(left.startAfter, right.startAfter));
    for (const schedule of schedules) {
      await this.#dependencies.jobEnqueuer.enqueueDelivery({
        campaignId: campaign.id,
        startAfter: schedule.startAfter,
        userIds: schedule.userIds,
      });
      this.#dependencies.logger.log({
        event: BroadcastLogEvent.DELIVERY_SCHEDULED,
        campaignId: campaign.id.value,
        startAfter: schedule.startAfter.toString(),
        recipientCount: schedule.userIds.length,
      });
    }
    return userIds.length;
  }
}
