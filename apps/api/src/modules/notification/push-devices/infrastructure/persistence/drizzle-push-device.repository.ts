import type { PushPermissionStatus } from "@aido/api/vocabulary";
import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, eq, gte, inArray, ne, or } from "drizzle-orm";
import { groupBy, mapValues, omit } from "es-toolkit";
import { match } from "ts-pattern";

import type { SessionId } from "#api/modules/identity/sessions/identity-sessions.public";
import {
  databaseConstraint,
  isUniqueConstraintViolation,
} from "#api/platform/database/database-error.util";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { pushDevice, pushToken } from "#api/platform/database/schema/index";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { PushChannel } from "../../../shared/domain/push-channel.constants.js";
import {
  PushDeviceRepositoryPort,
  type SavedPushDeviceResult,
} from "../../application/ports/push-device.repository.port.js";
import { pushTokenRegistrationConflict } from "../../application/push-devices.errors.js";
import type { PushDeviceId } from "../../domain/push-device-id.vo.js";
import type { PushDevice, PushDeviceTakeover } from "../../domain/push-device.aggregate.js";
import { toPushDeviceRow } from "./push-device-row.mapper.js";

const PUSH_TOKEN_TOKEN_UNIQUE_CONSTRAINT = "PushToken_token_key";

@Injectable()
export class DrizzlePushDeviceRepository implements PushDeviceRepositoryPort {
  readonly #transactionHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(transactionHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#transactionHost = transactionHost;
  }

  async save(device: PushDevice): Promise<SavedPushDeviceResult> {
    const releasedDevices = await this.#releaseDeviceHeldElsewhere(device.takeover);
    const releasedTokens = await this.#releaseTokenHeldElsewhere(device.takeover);
    const row = toPushDeviceRow(device);
    await this.#db
      .insert(pushDevice)
      .values(row)
      .onConflictDoUpdate({
        target: [pushDevice.userId, pushDevice.deviceId],
        set: omit(row, ["userId", "deviceId"]),
      });
    const hasActiveToken = await match(device.tokenChange)
      .with({ kind: "REGISTER" }, async (registration) => {
        await this.#registerToken(device, registration);
        return true;
      })
      .with({ kind: "KEEP" }, () => this.#keepToken(device))
      .with({ kind: "RELEASE" }, async () => {
        await this.#deleteToken(device);
        return false;
      })
      .exhaustive();
    return { previousOwnerIds: [...releasedDevices, ...releasedTokens], hasActiveToken };
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
    sessionIds: readonly SessionId[],
  ): Promise<{ readonly userIds: readonly UserId[] }> {
    const deleted = await this.#db
      .delete(pushDevice)
      .where(
        inArray(
          pushDevice.sessionId,
          sessionIds.map((sessionId) => sessionId.value),
        ),
      )
      .returning({ userId: pushDevice.userId });
    return { userIds: deleted.map((row) => UserId.reconstitute(row.userId)) };
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

  get #db() {
    return this.#transactionHost.tx;
  }

  async #releaseDeviceHeldElsewhere(takeover: PushDeviceTakeover): Promise<UserId[]> {
    const released = await this.#db
      .delete(pushDevice)
      .where(
        and(
          eq(pushDevice.deviceId, takeover.deviceId.value),
          ne(pushDevice.userId, takeover.userId.value),
        ),
      )
      .returning({ userId: pushDevice.userId });
    return released.map((row) => UserId.reconstitute(row.userId));
  }

  // 해제 요청(unregister)과 같은 삭제다. 그 등록의 발송 시도 기록은 FK cascade로 함께 지워진다
  async #releaseTokenHeldElsewhere(takeover: PushDeviceTakeover): Promise<UserId[]> {
    const userId = takeover.userId.value;
    const deviceId = takeover.deviceId.value;
    const sameDeviceOfOtherUser = and(
      eq(pushToken.deviceId, deviceId),
      ne(pushToken.userId, userId),
    );
    const released = await this.#db
      .delete(pushToken)
      .where(
        takeover.token == null
          ? sameDeviceOfOtherUser
          : or(
              sameDeviceOfOtherUser,
              and(
                eq(pushToken.token, takeover.token),
                or(ne(pushToken.userId, userId), ne(pushToken.deviceId, deviceId)),
              ),
            ),
      )
      .returning({ userId: pushToken.userId });
    return released.map((row) => UserId.reconstitute(row.userId));
  }

  async #registerToken(
    device: PushDevice,
    { token, channel }: { readonly token: string; readonly channel: PushChannel },
  ): Promise<void> {
    const { payloadVersion, appVersion } = device.pushToken;
    const values = {
      token,
      provider: channel,
      platform: device.platform,
      sessionId: device.sessionId,
      isActive: true,
      payloadVersion,
      appVersion,
      updatedAt: device.reportedAt,
    };
    try {
      await this.#db
        .insert(pushToken)
        .values({ ...values, userId: device.userId.value, deviceId: device.id.value })
        .onConflictDoUpdate({ target: [pushToken.userId, pushToken.deviceId], set: values });
    } catch (error) {
      if (
        isUniqueConstraintViolation(error) &&
        databaseConstraint(error) === PUSH_TOKEN_TOKEN_UNIQUE_CONSTRAINT
      ) {
        throw pushTokenRegistrationConflict(error);
      }
      throw error;
    }
  }

  async #keepToken(device: PushDevice): Promise<boolean> {
    const { payloadVersion, appVersion } = device.pushToken;
    const kept = await this.#db
      .update(pushToken)
      .set({
        sessionId: device.sessionId,
        payloadVersion,
        appVersion,
        updatedAt: device.reportedAt,
      })
      .where(
        and(eq(pushToken.userId, device.userId.value), eq(pushToken.deviceId, device.id.value)),
      )
      .returning({ isActive: pushToken.isActive });
    return kept.some((row) => row.isActive);
  }

  async #deleteToken(device: PushDevice): Promise<void> {
    await this.#db
      .delete(pushToken)
      .where(
        and(eq(pushToken.userId, device.userId.value), eq(pushToken.deviceId, device.id.value)),
      );
  }
}
