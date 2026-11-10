import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/index";

import { buildBroadcastMessages } from "../../messages/admin/broadcast-message.factory.js";
import { OperationsAdminLogEvent } from "../../observability/admin/operations-admin-log.events.js";
import { BROADCAST_FAN_OUT_POLICY } from "../../policies/admin/broadcast-fan-out.policy.js";
import type { AdminBroadcastNotifierPort } from "../../ports/admin/admin-broadcast-notifier.port.js";
import type { AdminUserDirectoryPort } from "../../ports/admin/admin-user-directory.port.js";
import type { BroadcastCampaignRepositoryPort } from "../../ports/admin/broadcast-campaign.repository.port.js";
import type { BroadcastFanOutEnqueuerPort } from "../../ports/admin/broadcast-fan-out.enqueuer.port.js";

type PageOutcome =
  | { readonly status: "done" }
  | { readonly status: "more"; readonly cursorUserId: string };

interface FanOutBroadcastCampaignDependencies {
  readonly repository: Pick<BroadcastCampaignRepositoryPort, "findByIdForUpdate" | "save">;
  readonly userDirectory: Pick<AdminUserDirectoryPort, "findTargetUserIdsAfter">;
  readonly notifier: Pick<AdminBroadcastNotifierPort, "sendBatch">;
  readonly fanOutEnqueuer: Pick<BroadcastFanOutEnqueuerPort, "enqueueFanOut">;
  readonly unitOfWork: Pick<UnitOfWorkPort, "run">;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

/**
 * 대상 사용자를 cursor 순서로 나눠 알림과 발송 outbox를 만든다. 페이지 저장과 cursor 전진이 한
 * transaction이라 작업이 중간에 죽어도 다음 실행이 마지막으로 커밋된 cursor부터 이어 간다.
 * 공급자 발송은 push-delivery 작업이 commit 뒤 따로 처리하므로 이 transaction은 DB 쓰기만 한다.
 */
export class FanOutBroadcastCampaign {
  readonly #dependencies: FanOutBroadcastCampaignDependencies;

  constructor(dependencies: FanOutBroadcastCampaignDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: { readonly campaignId: string }): Promise<void> {
    const deadline = Date.now() + BROADCAST_FAN_OUT_POLICY.runBudgetMs;
    for (;;) {
      const outcome = await this.#dependencies.unitOfWork.run(() =>
        this.#fanOutPage(input.campaignId),
      );
      if (outcome.status === "done") {
        return;
      }
      if (Date.now() >= deadline) {
        await this.#dependencies.fanOutEnqueuer.enqueueFanOut({
          campaignId: input.campaignId,
          cursorUserId: outcome.cursorUserId,
        });
        this.#dependencies.logger.log({
          event: OperationsAdminLogEvent.BROADCAST_CONTINUED,
          campaignId: input.campaignId,
        });
        return;
      }
    }
  }

  async #fanOutPage(campaignId: string): Promise<PageOutcome> {
    const campaign = await this.#dependencies.repository.findByIdForUpdate(campaignId);
    if (campaign == null || campaign.isTerminal()) {
      return { status: "done" };
    }
    const now = new Date();
    campaign.start(now);
    const userIds = await this.#dependencies.userDirectory.findTargetUserIdsAfter(
      campaign.targetFilter,
      campaign.cursorUserId,
      BROADCAST_FAN_OUT_POLICY.pageSize,
    );
    const lastUserId = userIds.at(-1);
    if (lastUserId != null) {
      const { count } = await this.#dependencies.notifier.sendBatch(
        buildBroadcastMessages(
          {
            title: campaign.title,
            body: campaign.body,
            type: "ADMIN_BROADCAST",
            action: campaign.action,
            force: campaign.force,
            campaignKey: campaign.campaignKey,
          },
          userIds,
        ),
      );
      campaign.recordPage({ lastUserId, processedCount: userIds.length, queuedCount: count });
    }
    const isLastPage = userIds.length < BROADCAST_FAN_OUT_POLICY.pageSize;
    if (isLastPage) {
      campaign.complete(now);
    }
    await this.#dependencies.repository.save(campaign);
    if (isLastPage || lastUserId == null) {
      this.#dependencies.logger.log({
        event: OperationsAdminLogEvent.BROADCAST_COMPLETED,
        campaignId,
        processedCount: campaign.processedCount,
        queuedCount: campaign.queuedCount,
      });
      return { status: "done" };
    }
    return { status: "more", cursorUserId: lastUserId };
  }
}
