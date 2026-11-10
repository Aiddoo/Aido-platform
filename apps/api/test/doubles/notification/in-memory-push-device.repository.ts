import type { PushPermissionStatus } from "@aido/api/vocabulary";

import { PushDeviceRepositoryPort } from "#api/modules/notification/push/application/ports/push-device.repository.port";
import { PushDevice } from "#api/modules/notification/push/domain/push-device.aggregate";

type DeviceKey = `${string}:${string}`;

function keyOf(userId: string, deviceId: string): DeviceKey {
  return `${userId}:${deviceId}`;
}

// 저장 사본을 두어 save 없이 바꾼 Aggregate가 저장소 상태로 새지 않게 한다
function copyOf(device: PushDevice): PushDevice {
  return PushDevice.reconstitute(device.toPrimitives());
}

// (userId, deviceId)마다 한 행이다. Drizzle처럼 토큰은 기기 행에 남기지 않는다
export class InMemoryPushDeviceRepository extends PushDeviceRepositoryPort {
  readonly #devices = new Map<DeviceKey, PushDevice>();

  constructor(devices: readonly PushDevice[] = []) {
    super();
    for (const device of devices) {
      this.#devices.set(keyOf(device.userId.value, device.id.value), copyOf(device));
    }
  }

  get size(): number {
    return this.#devices.size;
  }

  deviceOf(userId: string, deviceId: string): PushDevice | undefined {
    const device = this.#devices.get(keyOf(userId, deviceId));
    return device == null ? undefined : copyOf(device);
  }

  async releasePushDeviceHeldElsewhere(
    userId: string,
    deviceId: string,
  ): Promise<{ readonly userIds: readonly string[] }> {
    return this.#deleteWhere(
      (device) => device.id.value === deviceId && device.userId.value !== userId,
    );
  }

  async savePushDevice(device: PushDevice): Promise<void> {
    const stored = PushDevice.reconstitute({ ...device.toPrimitives(), token: null });
    this.#devices.set(keyOf(device.userId.value, device.id.value), stored);
  }

  async deletePushDevice(userId: string, deviceId: string): Promise<void> {
    this.#devices.delete(keyOf(userId, deviceId));
  }

  async deleteAllPushDevicesByUser(userId: string): Promise<void> {
    await this.#deleteWhere((device) => device.userId.value === userId);
  }

  async deletePushDevicesBySessions(
    sessionIds: readonly string[],
  ): Promise<{ readonly userIds: readonly string[] }> {
    return this.#deleteWhere(
      (device) => device.sessionId != null && sessionIds.includes(device.sessionId),
    );
  }

  async findPermissionStatusesByUsers(
    userIds: readonly string[],
    reportedSince: Temporal.Instant,
  ): Promise<ReadonlyMap<string, readonly PushPermissionStatus[]>> {
    const statusesByUser = new Map<string, PushPermissionStatus[]>();
    for (const device of this.#devices.values()) {
      const userId = device.userId.value;
      if (
        userIds.includes(userId) &&
        Temporal.Instant.compare(device.reportedAt, reportedSince) >= 0
      ) {
        statusesByUser.set(userId, [
          ...(statusesByUser.get(userId) ?? []),
          device.permission.status,
        ]);
      }
    }
    return statusesByUser;
  }

  async #deleteWhere(
    predicate: (device: PushDevice) => boolean,
  ): Promise<{ readonly userIds: readonly string[] }> {
    const deleted = [...this.#devices.entries()].filter(([, device]) => predicate(device));
    for (const [key] of deleted) {
      this.#devices.delete(key);
    }
    return { userIds: deleted.map(([, device]) => device.userId.value) };
  }
}
