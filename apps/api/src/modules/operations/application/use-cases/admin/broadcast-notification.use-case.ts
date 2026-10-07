import type { NotificationAction } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import { BroadcastCampaign } from "../../../domain/entities/admin/broadcast-campaign.js";
import type { BroadcastTargetFilter } from "../../../domain/policies/admin/broadcast-message.js";
import {
  type BroadcastResult,
  buildBroadcastResult,
} from "../../../domain/policies/admin/broadcast-result.js";
import { type AdminBroadcastNotifierPort } from "../../ports/admin/admin-broadcast-notifier.port.js";
import { type AdminUserDirectoryPort } from "../../ports/admin/admin-user-directory.port.js";

export interface BroadcastNotificationInput {
  title: string;
  body: string;
  targetFilter: BroadcastTargetFilter;
  action: NotificationAction | undefined;
  force: boolean;
}

/**
 * 전체/조건부 알림 브로드캐스트 use-case.
 *
 * 대상 필터에 해당하는 사용자에게 알림을 발송한다. 대상이 없으면 ADMIN_1402.
 */
interface BroadcastNotificationDependencies {
  readonly userDirectory: AdminUserDirectoryPort;
  readonly notifier: AdminBroadcastNotifierPort;
  readonly logger: ApplicationLogger;
}

export class BroadcastNotification {
  readonly #dependencies: BroadcastNotificationDependencies;

  constructor(dependencies: BroadcastNotificationDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: BroadcastNotificationInput): Promise<BroadcastResult> {
    // 도메인 불변식 검증(제목/본문 비어 있지 않음) 후 캠페인 생성
    const campaign = BroadcastCampaign.create({
      title: input.title,
      body: input.body,
      targetFilter: input.targetFilter,
      action: input.action,
      force: input.force,
    });

    let totalTargets = 0;
    let successCount = 0;

    // 대상 사용자를 배치로 스트리밍하며 배치마다 발송 (메모리 절약)
    for await (const userIds of this.#dependencies.userDirectory.streamTargetUserIds(
      campaign.targetFilter,
    )) {
      totalTargets += userIds.length;

      const { count } = await this.#dependencies.notifier.sendBatch(
        campaign.toMessages(userIds, "ADMIN_BROADCAST"),
      );
      successCount += count;
    }

    if (totalTargets === 0) {
      throw new ApplicationException(ErrorCode.ADMIN_1402, {
        targetFilter: input.targetFilter,
      });
    }

    this.#dependencies.logger.log(
      `Broadcast notification completed: ${successCount}/${totalTargets} sent, filter=${input.targetFilter}`,
    );

    return buildBroadcastResult(totalTargets, successCount);
  }
}
