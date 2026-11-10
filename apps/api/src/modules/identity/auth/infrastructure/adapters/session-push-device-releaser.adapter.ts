import { Inject, Injectable, Logger } from "@nestjs/common";

import {
  SESSION_PUSH_DEVICE_RELEASE,
  type SessionPushDeviceReleasePort,
} from "#api/modules/notification/notification-delivery.public";
import { toErrorType } from "#api/shared/application/utils/error-message.util";

import { IdentityLogEvent } from "../../application/auth.log-events.js";
import type { SessionPushDeviceReleaserPort } from "../../application/ports/session-push-device-releaser.port.js";

@Injectable()
export class SessionPushDeviceReleaserAdapter implements SessionPushDeviceReleaserPort {
  readonly #logger = new Logger(SessionPushDeviceReleaserAdapter.name);

  readonly #sessionPushDeviceRelease: SessionPushDeviceReleasePort;

  constructor(
    @Inject(SESSION_PUSH_DEVICE_RELEASE)
    sessionPushDeviceRelease: SessionPushDeviceReleasePort,
  ) {
    this.#sessionPushDeviceRelease = sessionPushDeviceRelease;
  }

  async releaseSessions(sessionIds: readonly string[]): Promise<void> {
    try {
      await this.#sessionPushDeviceRelease.releaseSessions(sessionIds);
    } catch (error) {
      this.#logger.warn({
        event: IdentityLogEvent.SESSION_PUSH_DEVICE_RELEASE_FAILED,
        sessionCount: sessionIds.length,
        errorType: toErrorType(error),
      });
    }
  }
}
