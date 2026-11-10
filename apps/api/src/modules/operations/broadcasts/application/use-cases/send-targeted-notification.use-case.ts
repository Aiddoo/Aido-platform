import type { BroadcastResult, NotificationAction } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";

import { ApplicationException } from "#api/shared/application/application.exception";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";

import { BroadcastContent } from "../../domain/broadcast-content.vo.js";
import { BroadcastLogEvent } from "../broadcasts.log-events.js";
import { buildBroadcastMessages } from "../messages/broadcast-message.messages.js";
import type { AdminBroadcastNotifierPort } from "../ports/admin-broadcast-notifier.port.js";
import type { AdminUserDirectoryPort } from "../ports/admin-user-directory.reader.port.js";

export interface SendTargetedNotificationInput {
  readonly title: string;
  readonly body: string;
  readonly userIds: readonly string[];
  readonly action: NotificationAction | undefined;
  readonly force: boolean;
}

interface SendTargetedNotificationDependencies {
  readonly userDirectory: Pick<AdminUserDirectoryPort, "findExistingUserIds">;
  readonly notifier: Pick<AdminBroadcastNotifierPort, "sendBatch">;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

export class SendTargetedNotificationUseCase {
  readonly #dependencies: SendTargetedNotificationDependencies;

  constructor(dependencies: SendTargetedNotificationDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: SendTargetedNotificationInput): Promise<BroadcastResult> {
    const content = BroadcastContent.create(input);
    const userIds = [...input.userIds];
    const existingUserIds = await this.#dependencies.userDirectory.findExistingUserIds(userIds);
    if (existingUserIds.length === 0) {
      throw new ApplicationException(ErrorCode.ADMIN_1402, { requested: userIds.length });
    }
    const { count } = await this.#dependencies.notifier.sendBatch(
      buildBroadcastMessages(
        {
          title: content.title,
          body: content.body,
          type: "ADMIN_TARGETED",
          action: input.action,
          force: input.force,
        },
        existingUserIds,
      ),
    );
    this.#dependencies.logger.log({
      event: BroadcastLogEvent.TARGETED_COMPLETED,
      count,
      totalTargets: existingUserIds.length,
    });
    return {
      successCount: count,
      failCount: existingUserIds.length - count,
      totalTargets: existingUserIds.length,
    };
  }
}
