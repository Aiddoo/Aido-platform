import { uniqBy } from "es-toolkit";

import type { SessionId } from "#api/modules/identity/sessions/identity-sessions.public";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

import type { PushDeviceRepositoryPort } from "../ports/push-device.repository.port.js";
import type { PushTokenCachePort } from "../ports/push-token-cache.port.js";
import type { PushTokenRepositoryPort } from "../ports/push-token.repository.port.js";
import { PushDeviceLogEvent } from "../push-devices.log-events.js";

export interface ReleaseSessionPushDevicesCommand {
  readonly sessionIds: readonly SessionId[];
}

interface ReleaseSessionPushDevicesDependencies {
  readonly pushDeviceRepository: Pick<PushDeviceRepositoryPort, "deletePushDevicesBySessions">;
  readonly pushTokenRepository: Pick<PushTokenRepositoryPort, "deletePushTokensBySessions">;
  readonly unitOfWork: Pick<UnitOfWorkPort, "run">;
  readonly cache: Pick<PushTokenCachePort, "invalidatePushTokens">;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

/**
 * 로그아웃·전체 로그아웃·비밀번호 변경·토큰 재사용 감지로 폐기된 세션의 기기를 바로 푸시 대상에서 뺀다.
 * 만료된 세션 행은 지우지 않으므로 그 기기는 앱이 기기 ID와 토큰으로 직접 해제한다(UnregisterPushDeviceByToken).
 */
export class ReleaseSessionPushDevicesUseCase {
  readonly #dependencies: ReleaseSessionPushDevicesDependencies;

  constructor(dependencies: ReleaseSessionPushDevicesDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: ReleaseSessionPushDevicesCommand): Promise<void> {
    const { sessionIds } = command;
    if (sessionIds.length === 0) {
      return;
    }
    const { pushDeviceRepository, pushTokenRepository, unitOfWork, cache, logger } =
      this.#dependencies;

    const { userIds, tokenCount } = await unitOfWork.run(async () => {
      const devices = await pushDeviceRepository.deletePushDevicesBySessions(sessionIds);
      const tokens = await pushTokenRepository.deletePushTokensBySessions(sessionIds);
      return {
        userIds: uniqBy([...devices.userIds, ...tokens.userIds], (userId) => userId.value),
        tokenCount: tokens.userIds.length,
      };
    });
    await Promise.all(userIds.map((userId) => cache.invalidatePushTokens(userId)));
    logger.log({
      event: PushDeviceLogEvent.RELEASE_SESSION_PUSH_DEVICES_RELEASED,
      sessionCount: sessionIds.length,
      tokenCount,
    });
  }
}
