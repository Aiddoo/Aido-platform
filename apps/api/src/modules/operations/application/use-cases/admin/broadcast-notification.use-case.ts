import { ErrorCode } from "@aido/api/errors";
import type { BroadcastTargetFilter } from "@aido/api/vocabulary";

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

export interface BroadcastNotificationInput {
  readonly title: string;
  readonly body: string;
  readonly targetFilter: BroadcastTargetFilter;
  readonly action: BroadcastAction | undefined;
  readonly force: boolean;
}

interface BroadcastNotificationDependencies {
  readonly userDirectory: Pick<AdminUserDirectoryPort, "streamTargetUserIds">;
  readonly notifier: Pick<AdminBroadcastNotifierPort, "sendBatch">;
  readonly logger: Pick<ApplicationLogger, "log">;
}

export class BroadcastNotification {
  readonly #dependencies: BroadcastNotificationDependencies;

  constructor(dependencies: BroadcastNotificationDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: BroadcastNotificationInput): Promise<BroadcastResult> {
    const content = BroadcastContent.create(input);
    const action = input.action === undefined ? undefined : { ...input.action };
    const { targetFilter } = input;
    const force = input.force ?? false;
    let totalTargets = 0;
    let successCount = 0;

    for await (const userIds of this.#dependencies.userDirectory.streamTargetUserIds(
      targetFilter,
    )) {
      totalTargets += userIds.length;
      const { count } = await this.#dependencies.notifier.sendBatch(
        buildBroadcastMessages(content, userIds, "ADMIN_BROADCAST", action, force),
      );
      successCount += count;
    }

    if (totalTargets === 0) {
      throw new ApplicationException(ErrorCode.ADMIN_1402, { targetFilter });
    }
    this.#dependencies.logger.log({
      event: OperationsAdminLogEvent.BROADCAST_COMPLETED,
      successCount,
      totalTargets,
      targetFilter,
    });
    return buildBroadcastResult(totalTargets, successCount);
  }
}
