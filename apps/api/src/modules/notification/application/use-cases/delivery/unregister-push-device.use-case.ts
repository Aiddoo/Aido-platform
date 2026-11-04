import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import type { UnitOfWorkPort } from "#api/shared/application/ports/index";

import { NotificationDeliveryLogEvent } from "../../observability/delivery/notification-delivery-log.events.js";
import type { NotificationCachePort } from "../../ports/delivery/notification-cache.port.js";
import type { PushDeviceRepositoryPort } from "../../ports/delivery/push-device.repository.port.js";
import type { PushTokenRepositoryPort } from "../../ports/delivery/push-token.repository.port.js";

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
  readonly logger: Pick<ApplicationLogger, "log">;
}

/** 로그아웃한 기기 하나, 또는 deviceId가 없으면(1.14.1 이하 앱) 사용자의 모든 기기를 푸시 대상에서 뺀다. */
export class UnregisterPushDevice {
  readonly #dependencies: UnregisterPushDeviceDependencies;

  constructor(dependencies: UnregisterPushDeviceDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(userId: string, deviceId?: string): Promise<void> {
    const { pushDeviceRepository, pushTokenRepository, unitOfWork, cache, logger } =
      this.#dependencies;

    if (deviceId == null) {
      const { count } = await unitOfWork.run(async () => {
        await pushDeviceRepository.deleteAllPushDevicesByUser(userId);
        return pushTokenRepository.deleteAllPushTokensByUser(userId);
      });
      await cache.invalidatePushTokens(userId);
      logger.log({
        event: NotificationDeliveryLogEvent.UNREGISTER_PUSH_DEVICE_ALL_UNREGISTERED,
        userId,
        tokenCount: count,
      });
      return;
    }

    const { count } = await unitOfWork.run(async () => {
      await pushDeviceRepository.deletePushDevice(userId, deviceId);
      return pushTokenRepository.deletePushTokensByDevice(userId, deviceId);
    });
    await cache.invalidatePushTokens(userId);
    logger.log({
      event: NotificationDeliveryLogEvent.UNREGISTER_PUSH_DEVICE_UNREGISTERED,
      userId,
      tokenCount: count,
    });
  }
}
