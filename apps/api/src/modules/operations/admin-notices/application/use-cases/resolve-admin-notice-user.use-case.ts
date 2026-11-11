import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import { toErrorType } from "#api/shared/application/utils/error-message.util";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { AdminNoticeLogEvent } from "../admin-notices.log-events.js";
import type { AdminNoticeUserReaderPort } from "../ports/admin-notice-user.reader.port.js";
import type { AdminNoticeUser } from "../read-models/admin-notice.read-model.js";

export interface ResolveAdminNoticeUserDependencies {
  readonly userReader: Pick<AdminNoticeUserReaderPort, "findById">;
  readonly logger: Pick<ApplicationLoggerPort, "warn">;
}

/**
 * 알림의 사용자 블록을 채운다. 조회가 실패하거나 사용자가 없으면 호출한 Context가 준 값으로 보내
 * 사용자 조회 때문에 알림을 잃지 않는다.
 */
export class ResolveAdminNoticeUserUseCase {
  readonly #dependencies: ResolveAdminNoticeUserDependencies;

  constructor(dependencies: ResolveAdminNoticeUserDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(fallback: AdminNoticeUser): Promise<AdminNoticeUser> {
    const { userReader, logger } = this.#dependencies;
    try {
      const found = await userReader.findById(UserId.reconstitute(fallback.userId));
      return found == null ? fallback : { ...fallback, ...found };
    } catch (error) {
      logger.warn({
        event: AdminNoticeLogEvent.USER_LOOKUP_FAILED,
        userId: fallback.userId,
        errorType: toErrorType(error),
      });
      return fallback;
    }
  }
}
