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
  PushTokenNotFoundError,
  PushTokenRegistrationConflictError,
  type PushTokenRepositoryPort,
} from "../../../application/ports/delivery/push-token.repository.port.js";
import type { PushTokenRecord } from "../../../application/read-models/delivery/push-token.read-model.js";

/** 구 앱은 deviceId 없이 등록한다. */
const DEFAULT_DEVICE_ID = "default";
const PUSH_TOKEN_TOKEN_UNIQUE_CONSTRAINT = "PushToken_token_key";

@Injectable()
export class DrizzlePushTokenRepository implements PushTokenRepositoryPort {
  constructor(private readonly txHost: TransactionHost<DrizzleTransactionalAdapter>) {}

  private get db() {
    return this.txHost.tx;
  }

  async releasePushTokenHeldElsewhere(
    data: Pick<RegisterPushTokenData, "userId" | "token" | "deviceId">,
  ): Promise<{ readonly userIds: readonly string[] }> {
    const deviceId = data.deviceId ?? DEFAULT_DEVICE_ID;
    // 해제 요청(unregister)과 같은 삭제다. 그 등록의 발송 시도 기록은 FK cascade로 함께 지워진다.
    const released = await this.db
      .delete(pushToken)
      .where(
        and(
          eq(pushToken.token, data.token),
          or(ne(pushToken.userId, data.userId), ne(pushToken.deviceId, deviceId)),
        ),
      )
      .returning({ userId: pushToken.userId });
    return { userIds: released.map((row) => row.userId) };
  }

  async registerPushToken(data: RegisterPushTokenData): Promise<PushTokenRecord> {
    const deviceId = data.deviceId ?? DEFAULT_DEVICE_ID;
    const platform = data.platform ?? "IOS";
    const payloadVersion = data.payloadVersion ?? 1;

    try {
      const [row] = await this.db
        .insert(pushToken)
        .values({
          userId: data.userId,
          token: data.token,
          deviceId,
          platform,
          isActive: true,
          payloadVersion,
          appVersion: data.appVersion,
        })
        .onConflictDoUpdate({
          target: [pushToken.userId, pushToken.deviceId],
          set: {
            token: data.token,
            platform,
            isActive: true,
            payloadVersion,
            appVersion: data.appVersion,
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

  async deletePushToken(userId: string, deviceId: string): Promise<PushTokenRecord> {
    const [row] = await this.db
      .delete(pushToken)
      .where(and(eq(pushToken.userId, userId), eq(pushToken.deviceId, deviceId)))
      .returning();
    if (row == null) {
      throw new PushTokenNotFoundError();
    }
    return row;
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
