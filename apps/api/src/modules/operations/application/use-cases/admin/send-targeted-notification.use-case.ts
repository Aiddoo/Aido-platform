import { ErrorCode } from "@aido/api/errors";

import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import { BroadcastContent } from "../../../domain/value-objects/admin/broadcast-content.vo.js";
import { buildBroadcastMessages } from "../../messages/admin/broadcast-message.factory.js";
import { OperationsAdminLogEvent } from "../../observability/admin/operations-admin-log.events.js";
import type { AdminBroadcastNotifierPort } from "../../ports/admin/admin-broadcast-notifier.port.js";
import type { AdminUserDirectoryPort } from "../../ports/admin/admin-user-directory.port.js";
import type { BroadcastAction } from "../../read-models/admin/broadcast-message.read-model.js";
import {
  buildBroadcastResult,
  type BroadcastResult,
} from "../../read-models/admin/broadcast-result.read-model.js";

export interface SendTargetedNotificationInput {
  readonly title: string;
  readonly body: string;
  readonly userIds: readonly string[];
  readonly action: BroadcastAction | undefined;
  readonly force: boolean;
}

interface SendTargetedNotificationDependencies {
  readonly userDirectory: Pick<AdminUserDirectoryPort, "findExistingUserIds">;
  readonly notifier: Pick<AdminBroadcastNotifierPort, "sendBatch">;
  readonly logger: Pick<ApplicationLogger, "log">;
}

export class SendTargetedNotification {
  readonly #dependencies: SendTargetedNotificationDependencies;

  constructor(dependencies: SendTargetedNotificationDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: SendTargetedNotificationInput): Promise<BroadcastResult> {
    const content = BroadcastContent.create(input);
    const action = input.action === undefined ? undefined : { ...input.action };
    const userIds = [...input.userIds];
    const force = input.force ?? false;
    const existingUserIds = await this.#dependencies.userDirectory.findExistingUserIds(userIds);
    if (existingUserIds.length === 0) {
      throw new ApplicationException(ErrorCode.ADMIN_1402, { requested: userIds.length });
    }
    const { count } = await this.#dependencies.notifier.sendBatch(
      buildBroadcastMessages(content, existingUserIds, "ADMIN_TARGETED", action, force),
    );
    this.#dependencies.logger.log({
      event: OperationsAdminLogEvent.TARGETED_COMPLETED,
      count,
      totalTargets: existingUserIds.length,
    });
    return buildBroadcastResult(existingUserIds.length, count);
  }
}
