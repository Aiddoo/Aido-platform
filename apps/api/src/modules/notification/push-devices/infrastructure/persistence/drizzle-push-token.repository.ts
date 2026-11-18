import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, asc, desc, eq, inArray, lt } from "drizzle-orm";

import type { SessionId } from "#api/modules/identity/sessions/identity-sessions.public";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { pushToken } from "#api/platform/database/schema/index";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

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
  }): Promise<{ readonly userIds: readonly UserId[] }> {
    const deleted = await this.#db
      .delete(pushToken)
      .where(and(eq(pushToken.token, data.token), eq(pushToken.deviceId, data.deviceId.value)))
      .returning({ userId: pushToken.userId });
    return { userIds: deleted.map((row) => UserId.reconstitute(row.userId)) };
  }

  async deletePushTokensBySessions(
    sessionIds: readonly SessionId[],
  ): Promise<{ readonly userIds: readonly UserId[] }> {
    const deleted = await this.#db
      .delete(pushToken)
      .where(
        inArray(
          pushToken.sessionId,
          sessionIds.map((sessionId) => sessionId.value),
        ),
      )
      .returning({ userId: pushToken.userId });
    return { userIds: deleted.map((row) => UserId.reconstitute(row.userId)) };
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

  async deactivateUnreportedSince({
    reportedBefore,
    deactivatedAt,
    limit,
  }: {
    readonly reportedBefore: Temporal.Instant;
    readonly deactivatedAt: Temporal.Instant;
    readonly limit: number;
  }): Promise<{ readonly userIds: readonly UserId[] }> {
    // 기기 보고(등록·유지)가 updatedAt을 보고 시각으로 쓰고, 끈 토큰은 isActive로 다시 고르지 않는다
    const unreported = this.#db
      .select({ id: pushToken.id })
      .from(pushToken)
      .where(and(eq(pushToken.isActive, true), lt(pushToken.updatedAt, reportedBefore)))
      .orderBy(asc(pushToken.updatedAt), asc(pushToken.id))
      .limit(limit)
      .for("update", { skipLocked: true });
    const deactivated = await this.#db
      .update(pushToken)
      .set({ isActive: false, updatedAt: deactivatedAt })
      .where(and(inArray(pushToken.id, unreported), eq(pushToken.isActive, true)))
      .returning({ userId: pushToken.userId });
    return { userIds: deactivated.map((row) => UserId.reconstitute(row.userId)) };
  }

  get #db() {
    return this.#transactionHost.tx;
  }
}
