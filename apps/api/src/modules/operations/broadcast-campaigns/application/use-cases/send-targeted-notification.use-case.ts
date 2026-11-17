import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import {
  BroadcastAction,
  type BroadcastActionPrimitives,
} from "../../domain/broadcast-action.vo.js";
import { BroadcastContent } from "../../domain/broadcast-content.vo.js";
import { targetedUsersNotFound } from "../broadcast-campaigns.errors.js";
import { BroadcastCampaignLogEvent } from "../broadcast-campaigns.log-events.js";
import { buildTargetedMessages } from "../messages/broadcast-message.messages.js";
import type { AdminBroadcastNotifierPort } from "../ports/admin-broadcast-notifier.port.js";
import type { AdminUserDirectoryReaderPort } from "../ports/admin-user-directory.reader.port.js";

export interface SendTargetedNotificationCommand {
  readonly title: string;
  readonly body: string;
  readonly userIds: readonly UserId[];
  readonly action?: BroadcastActionPrimitives;
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
    const existingUserIds = await userDirectory.listExistingUserIds(command.userIds);
    if (existingUserIds.length === 0) {
      throw targetedUsersNotFound(command.userIds.length);
    }

    const { count } = await notifier.sendBatch(
      buildTargetedMessages(
        {
          content,
          action: command.action == null ? null : BroadcastAction.create(command.action),
          force: command.force,
        },
        existingUserIds,
      ),
    );
    logger.log({
      event: BroadcastCampaignLogEvent.TARGETED_COMPLETED,
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
