import type { PushPermissionStatus } from "@aido/api/vocabulary";
import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, eq, gte, inArray, ne } from "drizzle-orm";
import { groupBy, mapValues, omit } from "es-toolkit";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { pushDevice } from "#api/platform/database/schema/index";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { PushDeviceRepositoryPort } from "../../application/ports/push-device.repository.port.js";
import type { PushDeviceId } from "../../domain/push-device-id.vo.js";
import type { PushDevice } from "../../domain/push-device.aggregate.js";
import { toPushDeviceRow } from "./push-device-row.mapper.js";

@Injectable()
export class DrizzlePushDeviceRepository implements PushDeviceRepositoryPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#txHost = txHost;
  }

  get #db() {
    return this.#txHost.tx;
  }

  async releasePushDeviceHeldElsewhere(
    userId: UserId,
    deviceId: PushDeviceId,
  ): Promise<{ readonly userIds: readonly string[] }> {
    const released = await this.#db
      .delete(pushDevice)
      .where(and(eq(pushDevice.deviceId, deviceId.value), ne(pushDevice.userId, userId.value)))
      .returning({ userId: pushDevice.userId });
    return { userIds: released.map((row) => row.userId) };
  }

  async savePushDevice(device: PushDevice): Promise<void> {
    const row = toPushDeviceRow(device);
    await this.#db
      .insert(pushDevice)
      .values(row)
      .onConflictDoUpdate({
        target: [pushDevice.userId, pushDevice.deviceId],
        set: omit(row, ["userId", "deviceId"]),
      });
  }

  async deletePushDevice(userId: UserId, deviceId: PushDeviceId): Promise<void> {
    await this.#db
      .delete(pushDevice)
      .where(and(eq(pushDevice.userId, userId.value), eq(pushDevice.deviceId, deviceId.value)));
  }

  async deleteAllPushDevicesByUser(userId: UserId): Promise<void> {
    await this.#db.delete(pushDevice).where(eq(pushDevice.userId, userId.value));
  }

  async deletePushDevicesBySessions(
    sessionIds: readonly string[],
  ): Promise<{ readonly userIds: readonly string[] }> {
    const deleted = await this.#db
      .delete(pushDevice)
      .where(inArray(pushDevice.sessionId, [...sessionIds]))
      .returning({ userId: pushDevice.userId });
    return { userIds: deleted.map((row) => row.userId) };
  }

  async findPermissionStatusesByUsers(
    userIds: readonly UserId[],
    reportedSince: Temporal.Instant,
  ): Promise<ReadonlyMap<string, readonly PushPermissionStatus[]>> {
    if (userIds.length === 0) {
      return new Map();
    }
    const rows = await this.#db
      .select({ userId: pushDevice.userId, status: pushDevice.permissionStatus })
      .from(pushDevice)
      .where(
        and(
          inArray(
            pushDevice.userId,
            userIds.map((userId) => userId.value),
          ),
          gte(pushDevice.reportedAt, reportedSince),
        ),
      );
    const statusesByUser = mapValues(
      groupBy(rows, (row) => row.userId),
      (userRows) => userRows.map((row) => row.status),
    );
    return new Map(Object.entries(statusesByUser));
  }
}
