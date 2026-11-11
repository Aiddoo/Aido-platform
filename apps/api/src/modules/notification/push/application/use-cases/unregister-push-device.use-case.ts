import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { NotificationCachePort } from "../../../inbox/application/ports/notification-cache.port.js";
import { PushDeviceId } from "../../domain/push-device-id.vo.js";
import { NotificationDeliveryLogEvent } from "../notification-delivery.log-events.js";
import type { PushDeviceRepositoryPort } from "../ports/push-device.repository.port.js";
import type { PushTokenRepositoryPort } from "../ports/push-token.repository.port.js";

interface UnregisterPushDeviceDependencies {
  readonly pushDeviceRepository: Pick<
    PushDeviceRepositoryPort,
    "deletePushDevice" | "deleteAllPushDevicesByUser"
  >;
  readonly pushTokenRepository: Pick<
    PushTokenRepositoryPort,
    "deletePushTokensByDevice" | "deleteAllPushTokensByUser"
  >;
  readonly unitOfWork: Pick<UnitOfWorkPort, "run">;
  readonly cache: Pick<NotificationCachePort, "invalidatePushTokens">;
  readonly logger: Pick<ApplicationLoggerPort, "log">;
}

/** 로그아웃한 기기 하나, 또는 deviceId가 없으면(1.14.1 이하 앱) 사용자의 모든 기기를 푸시 대상에서 뺀다. */
export class UnregisterPushDeviceUseCase {
  readonly #dependencies: UnregisterPushDeviceDependencies;

  constructor(dependencies: UnregisterPushDeviceDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(userId: string, deviceId?: string): Promise<void> {
    const { pushDeviceRepository, pushTokenRepository, unitOfWork, cache, logger } =
      this.#dependencies;
    const owner = UserId.reconstitute(userId);

    if (deviceId == null) {
      const { count } = await unitOfWork.run(async () => {
        await pushDeviceRepository.deleteAllPushDevicesByUser(owner);
        return pushTokenRepository.deleteAllPushTokensByUser(owner);
      });
      await cache.invalidatePushTokens(owner);
      logger.log({
        event: NotificationDeliveryLogEvent.UNREGISTER_PUSH_DEVICE_ALL_UNREGISTERED,
        userId,
        tokenCount: count,
      });
      return;
    }

    const { count } = await unitOfWork.run(async () => {
      const device = PushDeviceId.reconstitute(deviceId);
      await pushDeviceRepository.deletePushDevice(owner, device);
      return pushTokenRepository.deletePushTokensByDevice(owner, device);
    });
    await cache.invalidatePushTokens(owner);
    logger.log({
      event: NotificationDeliveryLogEvent.UNREGISTER_PUSH_DEVICE_UNREGISTERED,
      userId,
      tokenCount: count,
    });
  }
}
