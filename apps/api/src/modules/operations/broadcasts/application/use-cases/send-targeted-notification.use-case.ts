import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { BroadcastAction } from "../../domain/broadcast-campaign.aggregate.js";
import { BroadcastContent } from "../../domain/broadcast-content.vo.js";
import { targetedUsersNotFound } from "../broadcasts.errors.js";
import { BroadcastLogEvent } from "../broadcasts.log-events.js";
import { buildTargetedMessages } from "../messages/broadcast-message.messages.js";
import type { AdminBroadcastNotifierPort } from "../ports/admin-broadcast-notifier.port.js";
import type { AdminUserDirectoryReaderPort } from "../ports/admin-user-directory.reader.port.js";

export interface SendTargetedNotificationCommand {
  readonly title: string;
  readonly body: string;
  readonly userIds: readonly string[];
  readonly action?: BroadcastAction;
  readonly force: boolean;
}

export interface SendTargetedNotificationResult {
  readonly sentCount: number;
  readonly failedCount: number;
  readonly targetCount: number;
}

export interface SendTargetedNotificationDependencies {
  readonly userDirectory: Pick<AdminUserDirectoryReaderPort, "listExistingUserIds">;
  readonly notifier: Pick<AdminBroadcastNotifierPort, "sendBatch">;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

export class SendTargetedNotificationUseCase {
  readonly #dependencies: SendTargetedNotificationDependencies;

  constructor(dependencies: SendTargetedNotificationDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: SendTargetedNotificationCommand): Promise<SendTargetedNotificationResult> {
    const { userDirectory, notifier, logger } = this.#dependencies;
    const content = BroadcastContent.create({ title: command.title, body: command.body });
    const requestedUserIds = command.userIds.map((userId) => UserId.reconstitute(userId));
    const existingUserIds = await userDirectory.listExistingUserIds(requestedUserIds);
    if (existingUserIds.length === 0) {
      throw targetedUsersNotFound(requestedUserIds.length);
    }

    const { count } = await notifier.sendBatch(
      buildTargetedMessages(
        { content, action: command.action ?? null, force: command.force },
        existingUserIds,
      ),
    );
    logger.log({
      event: BroadcastLogEvent.TARGETED_COMPLETED,
      count,
      totalTargets: existingUserIds.length,
    });
    return {
      sentCount: count,
      failedCount: existingUserIds.length - count,
      targetCount: existingUserIds.length,
    };
  }
}
