import type { PushPermissionStatus } from "@aido/api/vocabulary";

import type { PushDeviceRepositoryPort } from "#api/modules/notification/push/application/ports/push-device.repository.port";
import {
  PushTokenRegistrationConflictError,
  type PushTokenRepositoryPort,
  type RegisterPushTokenData,
} from "#api/modules/notification/push/application/ports/push-token.repository.port";
import type { PushTokenRecord } from "#api/modules/notification/push/application/read-models/push-token.read-model";
import type { PushDevice } from "#api/modules/notification/push/domain/push-device.aggregate";

type DeviceKey = `${string}:${string}`;

function keyOf(userId: string, deviceId: string): DeviceKey {
  return `${userId}:${deviceId}`;
}

// 기기 기록과 토큰을 메모리에 두는 대역. 저장 결과와 소유권 이전을 상태로 확인한다
export class InMemoryPushDeviceStore
  implements
    PushDeviceRepositoryPort,
    Pick<
      PushTokenRepositoryPort,
      | "releasePushTokenHeldElsewhere"
      | "registerPushToken"
      | "deletePushTokensByDevice"
      | "deleteAllPushTokensByUser"
      | "deletePushTokensBySessions"
    >
{
  readonly devices = new Map<DeviceKey, PushDevice>();
  readonly tokens = new Map<DeviceKey, RegisterPushTokenData>();
  registerConflictsLeft = 0;
  registerCalls = 0;

  async releasePushDeviceHeldElsewhere(userId: string, deviceId: string) {
    const released = [...this.devices.values()].filter(
      (device) => device.id.value === deviceId && device.userId.value !== userId,
    );
    for (const device of released) {
      this.devices.delete(keyOf(device.userId.value, device.id.value));
    }
    return { userIds: released.map((device) => device.userId.value) };
  }

  async savePushDevice(device: PushDevice): Promise<void> {
    this.devices.set(keyOf(device.userId.value, device.id.value), device);
  }

  async deletePushDevice(userId: string, deviceId: string): Promise<void> {
    this.devices.delete(keyOf(userId, deviceId));
  }

  async deleteAllPushDevicesByUser(userId: string): Promise<void> {
    for (const device of this.devices.values()) {
      if (device.userId.value === userId) {
        this.devices.delete(keyOf(device.userId.value, device.id.value));
      }
    }
  }

  async releasePushTokenHeldElsewhere(data: {
    readonly userId: string;
    readonly deviceId: string;
    readonly token: string | null;
  }) {
    const released = [...this.tokens.values()].filter((row) => {
      const sameDeviceOfOtherUser = row.deviceId === data.deviceId && row.userId !== data.userId;
      const sameTokenElsewhere =
        row.token === data.token && (row.userId !== data.userId || row.deviceId !== data.deviceId);
      return sameDeviceOfOtherUser || sameTokenElsewhere;
    });
    for (const row of released) {
      this.tokens.delete(keyOf(row.userId, row.deviceId));
    }
    return { userIds: released.map((row) => row.userId) };
  }

  async registerPushToken(data: RegisterPushTokenData): Promise<PushTokenRecord> {
    this.registerCalls += 1;
    if (this.registerConflictsLeft > 0) {
      this.registerConflictsLeft -= 1;
      throw new PushTokenRegistrationConflictError();
    }
    this.tokens.set(keyOf(data.userId, data.deviceId), data);
    const now = data.registeredAt;
    return {
      id: this.registerCalls,
      userId: data.userId,
      token: data.token,
      deviceId: data.deviceId,
      platform: data.platform,
      isActive: true,
      payloadVersion: data.payloadVersion,
      appVersion: data.appVersion ?? null,
      createdAt: now,
      updatedAt: now,
      lastUsedAt: now,
    };
  }

  async deletePushTokensByDevice(userId: string, deviceId: string) {
    const existed = this.tokens.delete(keyOf(userId, deviceId));
    return { count: existed ? 1 : 0 };
  }

  async deleteAllPushTokensByUser(userId: string) {
    const owned = [...this.tokens.values()].filter((row) => row.userId === userId);
    for (const row of owned) {
      this.tokens.delete(keyOf(row.userId, row.deviceId));
    }
    return { count: owned.length };
  }

  async deletePushDevicesBySessions(sessionIds: readonly string[]) {
    const released = [...this.devices.values()].filter(
      (device) => device.sessionId != null && sessionIds.includes(device.sessionId),
    );
    for (const device of released) {
      this.devices.delete(keyOf(device.userId.value, device.id.value));
    }
    return { userIds: released.map((device) => device.userId.value) };
  }

  async deletePushTokensBySessions(sessionIds: readonly string[]) {
    const released = [...this.tokens.values()].filter(
      (row) => row.sessionId != null && sessionIds.includes(row.sessionId),
    );
    for (const row of released) {
      this.tokens.delete(keyOf(row.userId, row.deviceId));
    }
    return { userIds: released.map((row) => row.userId) };
  }

  async findPermissionStatusesByUsers(userIds: readonly string[], reportedSince: Temporal.Instant) {
    const statusesByUser = new Map<string, PushPermissionStatus[]>();
    for (const device of this.devices.values()) {
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

  tokenOf(userId: string, deviceId: string): string | undefined {
    return this.tokens.get(keyOf(userId, deviceId))?.token;
  }

  deviceOf(userId: string, deviceId: string): PushDevice | undefined {
    return this.devices.get(keyOf(userId, deviceId));
  }
}
