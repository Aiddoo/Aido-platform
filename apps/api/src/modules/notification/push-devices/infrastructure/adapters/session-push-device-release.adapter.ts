import { Injectable } from "@nestjs/common";

import type { SessionId } from "#api/modules/identity/sessions/identity-sessions.public";

import type { SessionPushDeviceReleasePort } from "../../application/ports/session-push-device-release.port.js";
import { ReleaseSessionPushDevicesUseCase } from "../../application/use-cases/release-session-push-devices.use-case.js";

// 다른 Context에 여는 문. 세션 목록을 UseCase 명령으로 넘긴다
@Injectable()
export class SessionPushDeviceReleaseAdapter implements SessionPushDeviceReleasePort {
  readonly #releaseSessionPushDevices: Pick<ReleaseSessionPushDevicesUseCase, "execute">;

  constructor(releaseSessionPushDevices: ReleaseSessionPushDevicesUseCase) {
    this.#releaseSessionPushDevices = releaseSessionPushDevices;
  }

  releaseSessions(sessionIds: readonly SessionId[]): Promise<void> {
    return this.#releaseSessionPushDevices.execute({ sessionIds });
  }
}
