import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, desc, eq, inArray } from "drizzle-orm";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { pushToken } from "#api/platform/database/schema/index";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import {
  type FindPushTokensParams,
  type PushTokenRepositoryPort,
} from "../../application/ports/push-token.repository.port.js";
import type { PushTokenReadModel } from "../../application/read-models/push-token.read-model.js";
import type { PushDeviceId } from "../../domain/push-device-id.vo.js";

@Injectable()
export class DrizzlePushTokenRepository implements PushTokenRepositoryPort {
  readonly #transactionHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(transactionHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#transactionHost = transactionHost;
  }

  findPushTokensByUser(params: FindPushTokensParams): Promise<PushTokenReadModel[]> {
    return this.#db
      .select()
      .from(pushToken)
      .where(
        and(
          eq(pushToken.userId, params.userId.value),
          params.activeOnly ? eq(pushToken.isActive, true) : undefined,
        ),
      )
      .orderBy(desc(pushToken.updatedAt));
  }

  findActivePushTokensByUsers(userIds: readonly UserId[]): Promise<PushTokenReadModel[]> {
    return this.#db
      .select()
      .from(pushToken)
      .where(
        and(
          inArray(
            pushToken.userId,
            userIds.map((userId) => userId.value),
          ),
          eq(pushToken.isActive, true),
        ),
      );
  }

  async deletePushTokensByDevice(
    userId: UserId,
    deviceId: PushDeviceId,
  ): Promise<{ count: number }> {
    const deleted = await this.#db
      .delete(pushToken)
      .where(and(eq(pushToken.userId, userId.value), eq(pushToken.deviceId, deviceId.value)))
      .returning({ id: pushToken.id });
    return { count: deleted.length };
  }

  async deleteAllPushTokensByUser(userId: UserId): Promise<{ count: number }> {
    const deleted = await this.#db
      .delete(pushToken)
      .where(eq(pushToken.userId, userId.value))
      .returning({ id: pushToken.id });
    return { count: deleted.length };
  }

  async deletePushTokenByDeviceAndToken(data: {
    readonly deviceId: PushDeviceId;
    readonly token: string;
  }): Promise<{ readonly userIds: readonly string[] }> {
    const deleted = await this.#db
      .delete(pushToken)
      .where(and(eq(pushToken.token, data.token), eq(pushToken.deviceId, data.deviceId.value)))
      .returning({ userId: pushToken.userId });
    return { userIds: deleted.map((row) => row.userId) };
  }

  async deletePushTokensBySessions(
    sessionIds: readonly string[],
  ): Promise<{ readonly userIds: readonly string[] }> {
    const deleted = await this.#db
      .delete(pushToken)
      .where(inArray(pushToken.sessionId, [...sessionIds]))
      .returning({ userId: pushToken.userId });
    return { userIds: deleted.map((row) => row.userId) };
  }

  async deactivateInvalidTokens(
    tokens: string[],
    deactivatedAt: Temporal.Instant,
  ): Promise<{ count: number }> {
    const updated = await this.#db
      .update(pushToken)
      .set({ isActive: false, updatedAt: deactivatedAt })
      .where(inArray(pushToken.token, tokens))
      .returning({ id: pushToken.id });
    return { count: updated.length };
  }

  get #db() {
    return this.#transactionHost.tx;
  }
}
