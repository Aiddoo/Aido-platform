import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, desc, eq, inArray, ne, or } from "drizzle-orm";

import {
  databaseConstraint,
  isUniqueConstraintViolation,
  requireRecord,
} from "#api/platform/database/database-error.util";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { pushToken } from "#api/platform/database/schema/index";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import {
  type FindPushTokensParams,
  PushTokenRegistrationConflictError,
  type PushTokenRepositoryPort,
  type RegisterPushTokenData,
} from "../../application/ports/push-token.repository.port.js";
import type { PushTokenRecord } from "../../application/read-models/push-token.read-model.js";
import type { PushDeviceId } from "../../domain/push-device-id.vo.js";

const PUSH_TOKEN_TOKEN_UNIQUE_CONSTRAINT = "PushToken_token_key";

@Injectable()
export class DrizzlePushTokenRepository implements PushTokenRepositoryPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
    this.#txHost = txHost;
  }

  get #db() {
    return this.#txHost.tx;
  }

  async releasePushTokenHeldElsewhere(
    data: Parameters<PushTokenRepositoryPort["releasePushTokenHeldElsewhere"]>[0],
  ): Promise<{ readonly userIds: readonly string[] }> {
    const userId = data.userId.value;
    const deviceId = data.deviceId.value;
    const sameDeviceOfOtherUser = and(
      eq(pushToken.deviceId, deviceId),
      ne(pushToken.userId, userId),
    );
    // 해제 요청(unregister)과 같은 삭제다. 그 등록의 발송 시도 기록은 FK cascade로 함께 지워진다.
    const released = await this.#db
      .delete(pushToken)
      .where(
        data.token == null
          ? sameDeviceOfOtherUser
          : or(
              sameDeviceOfOtherUser,
              and(
                eq(pushToken.token, data.token),
                or(ne(pushToken.userId, userId), ne(pushToken.deviceId, deviceId)),
              ),
            ),
      )
      .returning({ userId: pushToken.userId });
    return { userIds: released.map((row) => row.userId) };
  }

  async registerPushToken(data: RegisterPushTokenData): Promise<PushTokenRecord> {
    const {
      userId,
      token,
      deviceId,
      platform,
      sessionId,
      payloadVersion,
      appVersion,
      registeredAt,
    } = data;
    try {
      const [row] = await this.#db
        .insert(pushToken)
        .values({
          userId: userId.value,
          token,
          deviceId: deviceId.value,
          platform,
          sessionId,
          isActive: true,
          payloadVersion,
          appVersion,
          updatedAt: registeredAt,
        })
        .onConflictDoUpdate({
          target: [pushToken.userId, pushToken.deviceId],
          set: {
            token,
            platform,
            sessionId,
            isActive: true,
            payloadVersion,
            appVersion,
            updatedAt: registeredAt,
          },
        })
        .returning();
      return requireRecord(row);
    } catch (error) {
      if (
        isUniqueConstraintViolation(error) &&
        databaseConstraint(error) === PUSH_TOKEN_TOKEN_UNIQUE_CONSTRAINT
      ) {
        throw new PushTokenRegistrationConflictError({ cause: error });
      }
      throw error;
    }
  }

  findPushTokensByUser(params: FindPushTokensParams): Promise<PushTokenRecord[]> {
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

  findActivePushTokensByUsers(userIds: readonly UserId[]): Promise<PushTokenRecord[]> {
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
}
