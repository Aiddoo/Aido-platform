import type { NotificationAction } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import { BroadcastCampaign } from "../../../domain/entities/admin/broadcast-campaign.js";
import {
  type BroadcastResult,
  buildBroadcastResult,
} from "../../../domain/policies/admin/broadcast-result.js";
import { type AdminBroadcastNotifierPort } from "../../ports/admin/admin-broadcast-notifier.port.js";
import { type AdminUserDirectoryPort } from "../../ports/admin/admin-user-directory.port.js";

export interface SendTargetedNotificationInput {
  title: string;
  body: string;
  userIds: string[];
  action: NotificationAction | undefined;
  force: boolean;
}

/**
 * 특정 사용자 알림 발송 use-case.
 *
 * 존재하는 사용자만 필터링해 발송한다. 유효 대상이 없으면 ADMIN_1402.
 */
interface SendTargetedNotificationDependencies {
  readonly userDirectory: AdminUserDirectoryPort;
  readonly notifier: AdminBroadcastNotifierPort;
  readonly logger: ApplicationLogger;
}

export class SendTargetedNotification {
  readonly #dependencies: SendTargetedNotificationDependencies;

  constructor(dependencies: SendTargetedNotificationDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: SendTargetedNotificationInput): Promise<BroadcastResult> {
    // 타겟 발송은 필터가 없으므로 캠페인의 대상 필터는 사용하지 않는다(ALL 자리표시).
    // 제목/본문 불변식 검증과 메시지 조립만 캠페인에 위임한다.
    const campaign = BroadcastCampaign.create({
      title: input.title,
      body: input.body,
      targetFilter: "ALL",
      action: input.action,
      force: input.force,
    });

    const existingUserIds = await this.#dependencies.userDirectory.findExistingUserIds(
      input.userIds,
    );

    if (existingUserIds.length === 0) {
      throw new ApplicationException(ErrorCode.ADMIN_1402, {
        requested: input.userIds.length,
      });
    }

    this.#dependencies.logger.log(
      `Sending targeted notification to ${existingUserIds.length} users`,
    );

    const { count } = await this.#dependencies.notifier.sendBatch(
      campaign.toMessages(existingUserIds, "ADMIN_TARGETED"),
    );

    this.#dependencies.logger.log(`Targeted notification completed: ${count} notifications sent`);

    return buildBroadcastResult(existingUserIds.length, count);
  }
}
