import type { BroadcastTargetFilter } from "@aido/api/vocabulary";

import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

import {
  BroadcastAction,
  type BroadcastActionPrimitives,
} from "../../domain/broadcast-action.vo.js";
import { BroadcastCampaign } from "../../domain/broadcast-campaign.aggregate.js";
import { BroadcastContent } from "../../domain/broadcast-content.vo.js";
import {
  BroadcastDelivery,
  type BroadcastDeliveryPrimitives,
} from "../../domain/broadcast-delivery.vo.js";
import {
  BroadcastLocalizedContent,
  type BroadcastLocalizedCopy,
} from "../../domain/broadcast-localized-content.vo.js";
import { broadcastRequestConflict, broadcastTargetsEmpty } from "../broadcasts.errors.js";
import { BroadcastLogEvent } from "../broadcasts.log-events.js";
import type { AdminUserDirectoryReaderPort } from "../ports/admin-user-directory.reader.port.js";
import type { BroadcastCampaignRepositoryPort } from "../ports/broadcast-campaign.repository.port.js";
import type { BroadcastJobEnqueuerPort } from "../ports/broadcast-job-enqueuer.port.js";

export interface CreateBroadcastCampaignCommand {
  readonly requestId: string;
  readonly title: string;
  readonly body: string;
  readonly localizedContent?: BroadcastLocalizedCopy;
  readonly targetFilter: BroadcastTargetFilter;
  readonly action?: BroadcastActionPrimitives;
  readonly force: boolean;
  readonly delivery?: BroadcastDeliveryPrimitives;
}

export interface CreateBroadcastCampaignResult {
  readonly campaign: BroadcastCampaign;
  readonly targetCount: number;
}

export interface CreateBroadcastCampaignDependencies {
  readonly unitOfWork: Pick<UnitOfWorkPort, "run">;
  readonly campaignRepository: Pick<
    BroadcastCampaignRepositoryPort,
    "nextId" | "acceptByRequestId"
  >;
  readonly userDirectory: Pick<AdminUserDirectoryReaderPort, "countTargets">;
  readonly jobEnqueuer: Pick<BroadcastJobEnqueuerPort, "enqueueFanOut">;
  readonly clock: ClockPort;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

/**
 * 캠페인 저장과 첫 분배 작업 등록을 한 transaction으로 커밋한다. 같은 요청 ID의 재요청은
 * 새 캠페인이나 분배 작업을 만들지 않고 처음 접수한 캠페인을 돌려준다.
 */
export class CreateBroadcastCampaignUseCase {
  readonly #dependencies: CreateBroadcastCampaignDependencies;

  constructor(dependencies: CreateBroadcastCampaignDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: CreateBroadcastCampaignCommand): Promise<CreateBroadcastCampaignResult> {
    const { unitOfWork, campaignRepository, userDirectory, jobEnqueuer, clock, logger } =
      this.#dependencies;
    const draft = BroadcastCampaign.create({
      id: await campaignRepository.nextId(),
      requestId: command.requestId,
      content: BroadcastContent.create({ title: command.title, body: command.body }),
      localizedContent: BroadcastLocalizedContent.create(command.localizedContent),
      targetFilter: command.targetFilter,
      action: command.action == null ? null : BroadcastAction.create(command.action),
      force: command.force,
      delivery: BroadcastDelivery.create(command.delivery ?? { mode: "NOW" }),
      now: clock.now(),
    });

    const result = await unitOfWork.run(async () => {
      const targetCount = await userDirectory.countTargets(command.targetFilter);
      const { campaign, created } = await campaignRepository.acceptByRequestId(draft);
      if (!created) {
        if (!campaign.isSameRequest(draft)) {
          throw broadcastRequestConflict(command.requestId);
        }
        return { campaign, targetCount, created };
      }
      if (targetCount === 0) {
        throw broadcastTargetsEmpty(command.targetFilter);
      }
      await jobEnqueuer.enqueueFanOut({ campaignId: campaign.id, cursorUserId: null });
      return { campaign, targetCount, created };
    });

    logger.log({
      event: result.created
        ? BroadcastLogEvent.BROADCAST_ACCEPTED
        : BroadcastLogEvent.BROADCAST_REPLAYED,
      campaignId: result.campaign.id.value,
      targetFilter: command.targetFilter,
      targetCount: result.targetCount,
    });
    return { campaign: result.campaign, targetCount: result.targetCount };
  }
}
