import { Inject, Injectable, Logger } from "@nestjs/common";

import {
  SESSION_PUSH_DEVICE_RELEASE,
  type SessionPushDeviceReleasePort,
} from "#api/modules/notification/notification-delivery.public";
import { toErrorType } from "#api/shared/application/utils/error-message.util";

import { IdentityLogEvent } from "../../../application/observability/auth/identity-log.events.js";
import type { SessionPushDeviceReleaserPort } from "../../../application/ports/auth/session-push-device-releaser.port.js";

@Injectable()
export class SessionPushDeviceReleaserAdapter implements SessionPushDeviceReleaserPort {
  readonly #logger = new Logger(SessionPushDeviceReleaserAdapter.name);

  constructor(
    @Inject(SESSION_PUSH_DEVICE_RELEASE)
    private readonly sessionPushDeviceRelease: SessionPushDeviceReleasePort,
  ) {}

  async releaseSessions(sessionIds: readonly string[]): Promise<void> {
    try {
      await this.sessionPushDeviceRelease.releaseSessions(sessionIds);
    } catch (error) {
      this.#logger.warn({
        event: IdentityLogEvent.SESSION_PUSH_DEVICE_RELEASE_FAILED,
        sessionCount: sessionIds.length,
        errorType: toErrorType(error),
      });
    }
  }
}
