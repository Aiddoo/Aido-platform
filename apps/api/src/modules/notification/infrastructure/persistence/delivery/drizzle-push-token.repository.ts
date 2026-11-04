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

import type {
  FindPushTokensParams,
  RegisterPushTokenData,
} from "../../../application/ports/delivery/notification-data.js";
import {
  PushTokenRegistrationConflictError,
  type PushTokenRepositoryPort,
} from "../../../application/ports/delivery/push-token.repository.port.js";
import type { PushTokenRecord } from "../../../application/read-models/delivery/push-token.read-model.js";

const PUSH_TOKEN_TOKEN_UNIQUE_CONSTRAINT = "PushToken_token_key";

@Injectable()
export class DrizzlePushTokenRepository implements PushTokenRepositoryPort {
  constructor(private readonly txHost: TransactionHost<DrizzleTransactionalAdapter>) {}

  private get db() {
    return this.txHost.tx;
  }

  async releasePushTokenHeldElsewhere(
    data: Parameters<PushTokenRepositoryPort["releasePushTokenHeldElsewhere"]>[0],
  ): Promise<{ readonly userIds: readonly string[] }> {
    const sameDeviceOfOtherUser = and(
      eq(pushToken.deviceId, data.deviceId),
      ne(pushToken.userId, data.userId),
    );
    // 해제 요청(unregister)과 같은 삭제다. 그 등록의 발송 시도 기록은 FK cascade로 함께 지워진다.
    const released = await this.db
      .delete(pushToken)
      .where(
        data.token == null
          ? sameDeviceOfOtherUser
          : or(
              sameDeviceOfOtherUser,
              and(
                eq(pushToken.token, data.token),
                or(ne(pushToken.userId, data.userId), ne(pushToken.deviceId, data.deviceId)),
              ),
            ),
      )
      .returning({ userId: pushToken.userId });
    return { userIds: released.map((row) => row.userId) };
  }

  async registerPushToken(data: RegisterPushTokenData): Promise<PushTokenRecord> {
    const { userId, token, deviceId, platform, payloadVersion, appVersion } = data;
    try {
      const [row] = await this.db
        .insert(pushToken)
        .values({ userId, token, deviceId, platform, isActive: true, payloadVersion, appVersion })
        .onConflictDoUpdate({
          target: [pushToken.userId, pushToken.deviceId],
          set: { token, platform, isActive: true, payloadVersion, appVersion },
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
    return this.db
      .select()
      .from(pushToken)
      .where(
        and(
          eq(pushToken.userId, params.userId),
          params.activeOnly ? eq(pushToken.isActive, true) : undefined,
        ),
      )
      .orderBy(desc(pushToken.updatedAt));
  }

  findActivePushTokensByUsers(userIds: string[]): Promise<PushTokenRecord[]> {
    return this.db
      .select()
      .from(pushToken)
      .where(and(inArray(pushToken.userId, userIds), eq(pushToken.isActive, true)));
  }

  async deletePushTokensByDevice(userId: string, deviceId: string): Promise<{ count: number }> {
    const deleted = await this.db
      .delete(pushToken)
      .where(and(eq(pushToken.userId, userId), eq(pushToken.deviceId, deviceId)))
      .returning({ id: pushToken.id });
    return { count: deleted.length };
  }

  async deleteAllPushTokensByUser(userId: string): Promise<{ count: number }> {
    const deleted = await this.db
      .delete(pushToken)
      .where(eq(pushToken.userId, userId))
      .returning({ id: pushToken.id });
    return { count: deleted.length };
  }

  async deactivateInvalidTokens(tokens: string[]): Promise<{ count: number }> {
    const updated = await this.db
      .update(pushToken)
      .set({ isActive: false })
      .where(inArray(pushToken.token, tokens))
      .returning({ id: pushToken.id });
    return { count: updated.length };
  }
}
