import { Inject, Injectable, Logger } from "@nestjs/common";

import { SessionPushDeviceReleasePort } from "#api/modules/notification/notification-delivery.public";
import { toErrorType } from "#api/shared/application/utils/error-message.util";

import { AuthLogEvent } from "../../application/auth.log-events.js";
import type { SessionPushDeviceReleaserPort } from "../../application/ports/session-push-device-releaser.port.js";
import type { SessionId } from "../../domain/session-id.vo.js";

@Injectable()
export class SessionPushDeviceReleaserAdapter implements SessionPushDeviceReleaserPort {
  readonly #logger = new Logger(SessionPushDeviceReleaserAdapter.name);

  readonly #sessionPushDeviceRelease: SessionPushDeviceReleasePort;

  constructor(
    @Inject(SessionPushDeviceReleasePort)
    sessionPushDeviceRelease: SessionPushDeviceReleasePort,
  ) {
    this.#sessionPushDeviceRelease = sessionPushDeviceRelease;
  }

  async releaseSessions(sessionIds: readonly SessionId[]): Promise<void> {
    try {
      await this.#sessionPushDeviceRelease.releaseSessions(
        sessionIds.map((sessionId) => sessionId.value),
      );
    } catch (error) {
      this.#logger.warn({
        event: AuthLogEvent.SESSION_PUSH_DEVICE_RELEASE_FAILED,
        sessionCount: sessionIds.length,
        errorType: toErrorType(error),
      });
    }
  }
}
