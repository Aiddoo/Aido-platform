import { uniq } from "es-toolkit";

import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { NotificationCachePort } from "../../../inbox/application/ports/notification-cache.port.js";
import { NotificationDeliveryLogEvent } from "../notification-delivery.log-events.js";
import type { PushDeviceRepositoryPort } from "../ports/push-device.repository.port.js";
import type { PushTokenRepositoryPort } from "../ports/push-token.repository.port.js";
import type { SessionPushDeviceReleasePort } from "../ports/session-push-device-release.port.js";

interface ReleaseSessionPushDevicesDependencies {
  readonly pushDeviceRepository: Pick<PushDeviceRepositoryPort, "deletePushDevicesBySessions">;
  readonly pushTokenRepository: Pick<PushTokenRepositoryPort, "deletePushTokensBySessions">;
  readonly unitOfWork: Pick<UnitOfWorkPort, "run">;
  readonly cache: Pick<NotificationCachePort, "invalidatePushTokens">;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

/**
 * 로그아웃·전체 로그아웃·비밀번호 변경·토큰 재사용 감지로 폐기된 세션의 기기를 바로 푸시 대상에서 뺀다.
 * 만료된 세션 행은 지우지 않으므로 그 기기는 앱이 기기 ID와 토큰으로 직접 해제한다(UnregisterPushDeviceByToken).
 */
export class ReleaseSessionPushDevicesUseCase implements SessionPushDeviceReleasePort {
  readonly #dependencies: ReleaseSessionPushDevicesDependencies;

  constructor(dependencies: ReleaseSessionPushDevicesDependencies) {
    this.#dependencies = dependencies;
  }

  async releaseSessions(sessionIds: readonly string[]): Promise<void> {
    if (sessionIds.length === 0) {
      return;
    }
    const { pushDeviceRepository, pushTokenRepository, unitOfWork, cache, logger } =
      this.#dependencies;

    const { userIds, tokenCount } = await unitOfWork.run(async () => {
      const devices = await pushDeviceRepository.deletePushDevicesBySessions(sessionIds);
      const tokens = await pushTokenRepository.deletePushTokensBySessions(sessionIds);
      return {
        userIds: uniq([...devices.userIds, ...tokens.userIds]),
        tokenCount: tokens.userIds.length,
      };
    });
    await Promise.all(
      userIds.map((userId) => cache.invalidatePushTokens(UserId.reconstitute(userId))),
    );
    logger.log({
      event: NotificationDeliveryLogEvent.RELEASE_SESSION_PUSH_DEVICES_RELEASED,
      sessionCount: sessionIds.length,
      tokenCount,
    });
  }
}
