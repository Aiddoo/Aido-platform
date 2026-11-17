import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

import { PushDeviceId } from "../../domain/push-device-id.vo.js";
import type { PushDeviceRepositoryPort } from "../ports/push-device.repository.port.js";
import type { PushTokenCachePort } from "../ports/push-token-cache.port.js";
import type { PushTokenRepositoryPort } from "../ports/push-token.repository.port.js";
import { PushDeviceLogEvent } from "../push-devices.log-events.js";

export interface UnregisterPushDeviceByTokenCommand {
  readonly deviceId: string;
  readonly token: string;
}

interface UnregisterPushDeviceByTokenDependencies {
  readonly pushDeviceRepository: Pick<PushDeviceRepositoryPort, "deletePushDevice">;
  readonly pushTokenRepository: Pick<PushTokenRepositoryPort, "deletePushTokenByDeviceAndToken">;
  readonly unitOfWork: Pick<UnitOfWorkPort, "run">;
  readonly cache: Pick<PushTokenCachePort, "invalidatePushTokens">;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

/**
 * 세션이 끝나 로그아웃 해제를 보내지 못한 기기(갱신 토큰 만료·오프라인 로그아웃)를 푸시 대상에서 뺀다.
 * 세션으로 발송을 거르면 오래 쉰 사용자의 재방문 알림까지 막히므로 기기가 직접 해제한다.
 */
export class UnregisterPushDeviceByTokenUseCase {
  readonly #dependencies: UnregisterPushDeviceByTokenDependencies;

  constructor(dependencies: UnregisterPushDeviceByTokenDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: UnregisterPushDeviceByTokenCommand): Promise<void> {
    const { pushDeviceRepository, pushTokenRepository, unitOfWork, cache, logger } =
      this.#dependencies;
    const deviceId = PushDeviceId.reconstitute(command.deviceId);

    const { userIds } = await unitOfWork.run(async () => {
      const released = await pushTokenRepository.deletePushTokenByDeviceAndToken({
        deviceId,
        token: command.token,
      });
      // 토큰이 유일해 지운 등록은 많아야 하나다
      for (const userId of released.userIds) {
        await pushDeviceRepository.deletePushDevice(userId, deviceId);
      }
      return released;
    });
    await Promise.all(userIds.map((userId) => cache.invalidatePushTokens(userId)));
    logger.log({
      event: PushDeviceLogEvent.PUSH_DEVICE_UNREGISTERED_BY_TOKEN,
      userIds: userIds.map((userId) => userId.value),
      tokenCount: userIds.length,
    });
  }
}
