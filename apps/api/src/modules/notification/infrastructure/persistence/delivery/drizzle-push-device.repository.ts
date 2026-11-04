import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, eq, ne } from "drizzle-orm";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { pushDevice } from "#api/platform/database/schema/index";

import type { PushDeviceRepositoryPort } from "../../../application/ports/delivery/push-device.repository.port.js";
import type { PushDevice } from "../../../domain/aggregates/delivery/push-device.aggregate.js";

@Injectable()
export class DrizzlePushDeviceRepository implements PushDeviceRepositoryPort {
  constructor(private readonly txHost: TransactionHost<DrizzleTransactionalAdapter>) {}

  private get db() {
    return this.txHost.tx;
  }

  async releasePushDeviceHeldElsewhere(
    userId: string,
    deviceId: string,
  ): Promise<{ readonly userIds: readonly string[] }> {
    const released = await this.db
      .delete(pushDevice)
      .where(and(eq(pushDevice.deviceId, deviceId), ne(pushDevice.userId, userId)))
      .returning({ userId: pushDevice.userId });
    return { userIds: released.map((row) => row.userId) };
  }

  async savePushDevice(device: PushDevice): Promise<void> {
    const values = {
      platform: device.platform,
      permissionStatus: device.permission.status,
      permissionCanAskAgain: device.permission.canAskAgain,
      deviceModel: device.deviceModel,
      osVersion: device.osVersion,
      reportedAt: device.reportedAt,
    };
    await this.db
      .insert(pushDevice)
      .values({ userId: device.userId, deviceId: device.deviceId, ...values })
      .onConflictDoUpdate({ target: [pushDevice.userId, pushDevice.deviceId], set: values });
  }

  async deletePushDevice(userId: string, deviceId: string): Promise<void> {
    await this.db
      .delete(pushDevice)
      .where(and(eq(pushDevice.userId, userId), eq(pushDevice.deviceId, deviceId)));
  }

  async deleteAllPushDevicesByUser(userId: string): Promise<void> {
    await this.db.delete(pushDevice).where(eq(pushDevice.userId, userId));
  }
}
