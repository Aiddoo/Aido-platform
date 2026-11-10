import type { PushPermissionStatus } from "@aido/api/vocabulary";

import type { RegisterPushTokenData } from "#api/modules/notification/application/ports/delivery/notification-data";
import type { PushDeviceRepositoryPort } from "#api/modules/notification/application/ports/delivery/push-device.repository.port";
import {
  PushTokenRegistrationConflictError,
  type PushTokenRepositoryPort,
} from "#api/modules/notification/application/ports/delivery/push-token.repository.port";
import type { PushTokenRecord } from "#api/modules/notification/application/read-models/delivery/push-token.read-model";
import type { PushDevice } from "#api/modules/notification/domain/aggregates/delivery/push-device.aggregate";

type DeviceKey = `${string}:${string}`;

function keyOf(userId: string, deviceId: string): DeviceKey {
  return `${userId}:${deviceId}`;
}

/** 기기 기록과 토큰을 메모리에 두는 대역. 저장 결과와 소유권 이전을 상태로 확인한다. */
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
      (device) => device.deviceId === deviceId && device.userId !== userId,
    );
    for (const device of released) {
      this.devices.delete(keyOf(device.userId, device.deviceId));
    }
    return { userIds: released.map((device) => device.userId) };
  }

  async savePushDevice(device: PushDevice): Promise<void> {
    this.devices.set(keyOf(device.userId, device.deviceId), device);
  }

  async deletePushDevice(userId: string, deviceId: string): Promise<void> {
    this.devices.delete(keyOf(userId, deviceId));
  }

  async deleteAllPushDevicesByUser(userId: string): Promise<void> {
    for (const device of this.devices.values()) {
      if (device.userId === userId) {
        this.devices.delete(keyOf(device.userId, device.deviceId));
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
    const now = new Date("2026-11-04T00:00:00.000Z");
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
      this.devices.delete(keyOf(device.userId, device.deviceId));
    }
    return { userIds: released.map((device) => device.userId) };
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

  async findPermissionStatusesByUsers(userIds: readonly string[], reportedSince: Date) {
    const statusesByUser = new Map<string, PushPermissionStatus[]>();
    for (const device of this.devices.values()) {
      if (userIds.includes(device.userId) && device.reportedAt >= reportedSince) {
        statusesByUser.set(device.userId, [
          ...(statusesByUser.get(device.userId) ?? []),
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
