import { Injectable, Logger } from "@nestjs/common";

import type { SessionId } from "#api/modules/identity/sessions/identity-sessions.public";
import { toErrorType } from "#api/shared/application/utils/error-message.util";

import type { SessionPushDeviceReleaserPort } from "../../application/ports/session-push-device-releaser.port.js";
import { PushDeviceLogEvent } from "../../application/push-devices.log-events.js";
import { ReleaseSessionPushDevicesUseCase } from "../../application/use-cases/release-session-push-devices.use-case.js";

// 다른 Context에 여는 문. 해제가 실패해도 로그아웃·비밀번호 변경 같은 세션 폐기를 막지 않는다
@Injectable()
export class SessionPushDeviceReleaserAdapter implements SessionPushDeviceReleaserPort {
  readonly #logger = new Logger(SessionPushDeviceReleaserAdapter.name);

  readonly #releaseSessionPushDevices: Pick<ReleaseSessionPushDevicesUseCase, "execute">;

  constructor(releaseSessionPushDevices: ReleaseSessionPushDevicesUseCase) {
    this.#releaseSessionPushDevices = releaseSessionPushDevices;
  }

  async releaseSessions(sessionIds: readonly SessionId[]): Promise<void> {
    try {
      await this.#releaseSessionPushDevices.execute({ sessionIds });
    } catch (error) {
      this.#logger.warn({
        event: PushDeviceLogEvent.RELEASE_SESSION_PUSH_DEVICES_FAILED,
        sessionCount: sessionIds.length,
        errorType: toErrorType(error),
      });
    }
  }
}
