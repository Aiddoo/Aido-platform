import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";

import { OperationsNotificationsLogEvent } from "../../observability/notifications/operations-notifications-log.events.js";
import type { AdminNoticeUserReaderPort } from "../../ports/notifications/admin-notice-user.reader.port.js";
import type { AdminNoticeUser } from "../../read-models/notifications/admin-notice.read-model.js";

interface AdminNoticeUserResolverDependencies {
  readonly reader: Pick<AdminNoticeUserReaderPort, "findById">;
  readonly logger: Pick<ApplicationLoggerPort, "warn">;
}

/**
 * 알림의 사용자 블록을 채운다. 조회가 실패하거나 사용자가 없으면 호출한 Context가 준 값으로 보내
 * 사용자 조회 때문에 알림을 잃지 않는다.
 */
export class AdminNoticeUserResolver {
  readonly #dependencies: AdminNoticeUserResolverDependencies;

  constructor(dependencies: AdminNoticeUserResolverDependencies) {
    this.#dependencies = dependencies;
  }

  async resolve(fallback: AdminNoticeUser): Promise<AdminNoticeUser> {
    try {
      const found = await this.#dependencies.reader.findById(fallback.userId);
      return found == null ? fallback : { ...fallback, ...found };
    } catch (error) {
      this.#dependencies.logger.warn({
        event: OperationsNotificationsLogEvent.USER_LOOKUP_FAILED,
        userId: fallback.userId,
        errorType: toErrorType(error),
      });
      return fallback;
    }
  }
}
