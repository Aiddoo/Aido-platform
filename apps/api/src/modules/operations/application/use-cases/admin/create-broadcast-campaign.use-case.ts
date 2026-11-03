import type { NotificationAction } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";
import type { BroadcastTargetFilter } from "@aido/api/vocabulary";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import type { UnitOfWorkPort } from "#api/shared/application/ports/index";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import { BroadcastCampaign } from "../../../domain/aggregates/admin/broadcast-campaign.aggregate.js";
import { BroadcastContent } from "../../../domain/value-objects/admin/broadcast-content.vo.js";
import { OperationsAdminLogEvent } from "../../observability/admin/operations-admin-log.events.js";
import type { AdminUserDirectoryPort } from "../../ports/admin/admin-user-directory.port.js";
import type { BroadcastCampaignRepositoryPort } from "../../ports/admin/broadcast-campaign.repository.port.js";
import type { BroadcastFanOutEnqueuerPort } from "../../ports/admin/broadcast-fan-out.enqueuer.port.js";

export interface CreateBroadcastCampaignInput {
  readonly requestId: string;
  readonly title: string;
  readonly body: string;
  readonly targetFilter: BroadcastTargetFilter;
  readonly action: NotificationAction | undefined;
  readonly force: boolean;
}

export interface CreateBroadcastCampaignResult {
  readonly campaign: BroadcastCampaign;
  readonly targetCount: number;
}

interface CreateBroadcastCampaignDependencies {
  readonly repository: Pick<BroadcastCampaignRepositoryPort, "createOrFind">;
  readonly userDirectory: Pick<AdminUserDirectoryPort, "countTargets">;
  readonly fanOutEnqueuer: Pick<BroadcastFanOutEnqueuerPort, "enqueueFanOut">;
  readonly unitOfWork: Pick<UnitOfWorkPort, "run">;
  readonly logger: Pick<ApplicationLogger, "log">;
}

/**
 * 캠페인 저장과 첫 분배 작업 등록을 한 transaction으로 커밋한다. 같은 요청 ID의 재요청은
 * 새 캠페인이나 분배 작업을 만들지 않고 처음 접수한 캠페인을 돌려준다.
 */
export class CreateBroadcastCampaign {
  readonly #dependencies: CreateBroadcastCampaignDependencies;

  constructor(dependencies: CreateBroadcastCampaignDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: CreateBroadcastCampaignInput): Promise<CreateBroadcastCampaignResult> {
    const plan = BroadcastCampaign.planCreation({
      requestId: input.requestId,
      content: BroadcastContent.create(input),
      targetFilter: input.targetFilter,
      action: input.action,
      force: input.force,
      createdAt: new Date(),
    });
    const result = await this.#dependencies.unitOfWork.run(async () => {
      const targetCount = await this.#dependencies.userDirectory.countTargets(input.targetFilter);
      const { campaign, created } = await this.#dependencies.repository.createOrFind(plan);
      if (!created) {
        if (!campaign.isSameRequest(plan)) {
          throw new ApplicationException(ErrorCode.ADMIN_1405, { requestId: input.requestId });
        }
        return { campaign, targetCount, created };
      }
      if (targetCount === 0) {
        throw new ApplicationException(ErrorCode.ADMIN_1402, { targetFilter: input.targetFilter });
      }
      await this.#dependencies.fanOutEnqueuer.enqueueFanOut({
        campaignId: campaign.id,
        cursorUserId: null,
      });
      return { campaign, targetCount, created };
    });
    this.#dependencies.logger.log({
      event: result.created
        ? OperationsAdminLogEvent.BROADCAST_ACCEPTED
        : OperationsAdminLogEvent.BROADCAST_REPLAYED,
      campaignId: result.campaign.id,
      targetFilter: input.targetFilter,
      targetCount: result.targetCount,
    });
    return { campaign: result.campaign, targetCount: result.targetCount };
  }
}
