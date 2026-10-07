import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { all, and } from "@prisma/orm-postgres/orm-client";

import { decodeRecord, encodeCreate, encodePatch } from "#api/platform/database/database-records";
import { varchar } from "#api/platform/database/database-values";
import { requireRecord } from "#api/platform/database/prisma-error.util";
import { isRecordNotFoundError } from "#api/platform/database/prisma-error.util";
import type { Prisma8TransactionalAdapter } from "#api/platform/database/prisma8-transactional.adapter";
import { now } from "#api/shared/domain/date/utils/core";

import type {
  FindPushTokensParams,
  RegisterPushTokenData,
} from "../../../application/ports/delivery/notification-data.js";
import {
  PushTokenNotFoundError,
  type PushTokenRepositoryPort,
} from "../../../application/ports/delivery/push-token.repository.port.js";
import type { PushTokenRecord } from "../../../application/read-models/delivery/push-token.read-model.js";

@Injectable()
export class PrismaPushTokenRepository implements PushTokenRepositoryPort {
  constructor(private readonly txHost: TransactionHost<Prisma8TransactionalAdapter>) {}

  private get client() {
    return this.txHost.tx;
  }

  async registerPushToken(data: RegisterPushTokenData): Promise<PushTokenRecord> {
    const deviceId = data.deviceId ?? "default";
    const platform = data.platform ?? "IOS";

    return this.client.orm.public.PushToken.where((row) =>
      and(row.userId.eq(data.userId), row.deviceId.eq(varchar(deviceId, 255))),
    )
      .upsert({
        conflictOn: encodePatch("PushToken", { userId: data.userId, deviceId }),
        create: encodeCreate("PushToken", {
          userId: data.userId,
          token: data.token,
          deviceId,
          platform,
          isActive: true,
          payloadVersion: data.payloadVersion ?? 1,
          appVersion: data.appVersion,
        }),
        update: encodePatch("PushToken", {
          token: data.token,
          platform,
          isActive: true,
          payloadVersion: data.payloadVersion ?? 1,
          appVersion: data.appVersion,
          updatedAt: now(),
        }),
      })
      .then((row) => decodeRecord("PushToken", row));
  }

  async findPushTokensByUser(params: FindPushTokensParams): Promise<PushTokenRecord[]> {
    return this.client.orm.public.PushToken.where((row) =>
      and(row.userId.eq(params.userId), params.activeOnly ? row.isActive.eq(true) : all()),
    )
      .orderBy((row) => row.updatedAt.desc())
      .all()
      .then((row) => decodeRecord("PushToken", row));
  }

  async findActivePushTokensByUsers(userIds: string[]): Promise<PushTokenRecord[]> {
    return this.client.orm.public.PushToken.where((row) =>
      and(row.userId.in(userIds), row.isActive.eq(true)),
    )
      .all()
      .then((row) => decodeRecord("PushToken", row));
  }

  async deletePushToken(userId: string, deviceId: string): Promise<PushTokenRecord> {
    try {
      return decodeRecord(
        "PushToken",
        requireRecord(
          await this.client.orm.public.PushToken.where((row) =>
            and(row.userId.eq(userId), row.deviceId.eq(varchar(deviceId, 255))),
          ).delete(),
        ),
      );
    } catch (error) {
      if (isRecordNotFoundError(error)) {
        throw new PushTokenNotFoundError();
      }
      throw error;
    }
  }

  async deleteAllPushTokensByUser(userId: string): Promise<{ count: number }> {
    return this.client.orm.public.PushToken.where((row) => row.userId.eq(userId))
      .deleteAndCount()
      .then((count) => ({ count }));
  }

  async deactivateInvalidTokens(tokens: string[]): Promise<{ count: number }> {
    return this.client.orm.public.PushToken.where((row) =>
      row.token.in(tokens.map((value) => varchar(value, 255))),
    )
      .updateAndCount(encodePatch("PushToken", { isActive: false }))
      .then((count) => ({ count }));
  }
}
