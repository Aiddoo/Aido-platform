import { ErrorCode } from "@aido/api/errors";
import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable, Logger } from "@nestjs/common";
import { and, eq, isNotNull, lt, sql } from "drizzle-orm";

import {
  type AuthAccountLifecycleRepositoryPort,
  AuthPersistenceConflict,
  type AuthUserProfileRecord,
  type AuthUserRepositoryPort,
} from "#api/modules/identity/application/ports/auth/auth-persistence.port";
import { requireRecord, uniqueConstraintTargets } from "#api/platform/database/database-error.util";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { user, userActivityDay, userProfile } from "#api/platform/database/schema/index";
import { subtractDays } from "#api/shared/domain/date/utils/arithmetic";
import { now } from "#api/shared/domain/date/utils/core";
import { startOfDayInTimezone } from "#api/shared/domain/date/utils/timezone";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import { generateUserTag } from "./user-tag.generator.js";

type UserRow = typeof user.$inferSelect;
type UserInsert = typeof user.$inferInsert;
type UserStatus = UserRow["status"];

export interface UserWithAccount {
  id: string;
  email: string;
  status: UserStatus;
  emailVerifiedAt: Date | null;
  accounts: {
    id: number;
    provider: string;
    password: string | null;
  }[];
}

export interface UserWithProfile extends AuthUserProfileRecord {
  lastLoginAt: Date | null;
}

@Injectable()
export class DrizzleUserRepository
  implements AuthUserRepositoryPort, AuthAccountLifecycleRepositoryPort
{
  readonly #logger = new Logger(DrizzleUserRepository.name);
  private static readonly MAX_USER_TAG_RETRIES = 5;

  constructor(private readonly txHost: TransactionHost<DrizzleTransactionalAdapter>) {}

  private get db() {
    return this.txHost.tx;
  }

  async findByEmail(email: string): Promise<UserRow | null> {
    const row = await this.db.query.user.findFirst({ where: { email } });
    return row ?? null;
  }

  async findByEmailWithCredential(email: string): Promise<UserWithAccount | null> {
    const row = await this.db.query.user.findFirst({
      columns: { id: true, email: true, status: true, emailVerifiedAt: true },
      where: { email },
      with: {
        accounts: {
          columns: { id: true, provider: true, password: true },
          where: { provider: "CREDENTIAL" },
        },
      },
    });
    return row ?? null;
  }

  async findById(id: string): Promise<UserRow | null> {
    const row = await this.db.query.user.findFirst({ where: { id } });
    return row ?? null;
  }

  async findByIdWithProfile(id: string): Promise<UserWithProfile | null> {
    const row = await this.db.query.user.findFirst({
      columns: {
        id: true,
        email: true,
        userTag: true,
        role: true,
        status: true,
        emailVerifiedAt: true,
        subscriptionStatus: true,
        subscriptionExpiresAt: true,
        createdAt: true,
        deletedAt: true,
        lastLoginAt: true,
      },
      where: { id },
      with: {
        profile: { columns: { name: true, profileImage: true } },
        accounts: { columns: { provider: true } },
      },
    });
    return row ?? null;
  }

  async existsByEmail(email: string): Promise<boolean> {
    const count = await this.db.$count(user, eq(user.email, email));
    return count > 0;
  }

  // userTag가 없으면 자동 생성 (중복 시 재시도)
  async create(data: Omit<UserInsert, "userTag"> & { userTag?: string }): Promise<UserRow> {
    // userTag가 제공되지 않으면 자동 생성
    const userTag = data.userTag ?? (await this.#generateUniqueUserTag());

    try {
      const [row] = await this.db
        .insert(user)
        .values({ ...data, userTag })
        .returning();
      return requireRecord(row);
    } catch (error) {
      if (uniqueConstraintTargets(error)?.includes("email")) {
        throw new AuthPersistenceConflict("EMAIL_ALREADY_EXISTS");
      }
      throw error;
    }
  }

  async #generateUniqueUserTag(): Promise<string> {
    for (let i = 0; i < DrizzleUserRepository.MAX_USER_TAG_RETRIES; i++) {
      const tag = generateUserTag();
      const exists = await this.db.query.user.findFirst({
        columns: { id: true },
        where: { userTag: tag },
      });

      if (!exists) {
        return tag;
      }

      this.#logger.warn(`User tag collision detected: ${tag}, retrying...`);
    }

    // 모든 재시도 실패 시 (극히 드문 경우)
    throw new ApplicationException(ErrorCode.USER_0611, {
      attempts: DrizzleUserRepository.MAX_USER_TAG_RETRIES,
    });
  }

  async updateStatus(id: string, status: UserStatus): Promise<UserRow> {
    return this.update(id, { status });
  }

  async markEmailVerified(id: string): Promise<UserRow> {
    return this.update(id, { emailVerifiedAt: now(), status: "ACTIVE" });
  }

  async findLastSeenAppVersion(userId: string): Promise<string | null> {
    const row = await this.db.query.user.findFirst({
      columns: { lastSeenAppVersion: true },
      where: { id: userId },
    });
    return row?.lastSeenAppVersion ?? null;
  }

  async updateLastActiveAt(id: string, timezone: string, appVersion?: string): Promise<void> {
    const seenAt = now();
    const localDate = startOfDayInTimezone(seenAt, timezone);

    await this.db.execute(sql`
      WITH updated_user AS (
        UPDATE "User" AS app_user
        SET
          "lastActiveAt" = GREATEST(
            COALESCE(app_user."lastActiveAt", ${sql.param(seenAt, user.lastActiveAt)}::timestamp(3)),
            ${sql.param(seenAt, user.lastActiveAt)}::timestamp(3)
          ),
          "lastSeenAppVersion" = COALESCE(${appVersion ?? null}::VARCHAR(30), app_user."lastSeenAppVersion"),
          "lastSeenAppVersionAt" = CASE
            WHEN ${appVersion ?? null}::VARCHAR(30) IS NULL THEN app_user."lastSeenAppVersionAt"
            ELSE ${sql.param(seenAt, user.lastSeenAppVersionAt)}::timestamp(3)
          END,
          "updatedAt" = GREATEST(app_user."updatedAt", ${sql.param(seenAt, user.updatedAt)}::timestamp(3))
        WHERE app_user."id" = ${id}
        RETURNING app_user."id"
      )
      INSERT INTO "UserActivityDay" (
        "userId",
        "localDate",
        "timezone",
        "firstSeenAt",
        "lastSeenAt"
      )
      SELECT
        updated_user."id",
        ${sql.param(localDate, userActivityDay.localDate)}::DATE,
        ${timezone},
        ${sql.param(seenAt, userActivityDay.firstSeenAt)}::timestamp(3),
        ${sql.param(seenAt, userActivityDay.lastSeenAt)}::timestamp(3)
      FROM updated_user
      ON CONFLICT ("userId", "localDate")
      DO UPDATE SET
        "timezone" = CASE
          WHEN EXCLUDED."lastSeenAt" >= "UserActivityDay"."lastSeenAt"
            THEN EXCLUDED."timezone"
          ELSE "UserActivityDay"."timezone"
        END,
        "firstSeenAt" = LEAST(
          "UserActivityDay"."firstSeenAt",
          EXCLUDED."firstSeenAt"
        ),
        "lastSeenAt" = GREATEST(
          "UserActivityDay"."lastSeenAt",
          EXCLUDED."lastSeenAt"
        )
    `);
  }

  async createProfile(
    userId: string,
    data: { name?: string; profileImage?: string },
  ): Promise<void> {
    await this.db.insert(userProfile).values({
      userId,
      name: data.name ?? null,
      profileImage: data.profileImage ?? null,
    });
  }

  async updateProfile(
    userId: string,
    data: { name?: string | null; profileImage?: string | null },
  ): Promise<{ name: string | null; profileImage: string | null }> {
    // upsert로 프로필이 없는 경우에도 생성
    const [profile] = await this.db
      .insert(userProfile)
      .values({
        userId,
        name: data.name ?? null,
        profileImage: data.profileImage ?? null,
      })
      .onConflictDoUpdate({
        target: userProfile.userId,
        // nullish-strict: PATCH라 undefined는 그대로 두고 null은 비운다. userId는 빈 set을 피하는 무변경 값이다.
        set: { userId, name: data.name, profileImage: data.profileImage },
      })
      .returning({ name: userProfile.name, profileImage: userProfile.profileImage });
    return requireRecord(profile);
  }

  async softDelete(id: string, deletedAt: Date = now()): Promise<UserRow> {
    return this.update(id, { deletedAt, status: "SUSPENDED" });
  }

  async restore(id: string): Promise<UserRow> {
    return this.update(id, { deletedAt: null, status: "ACTIVE" });
  }

  async findSoftDeletedForPurge(
    gracePeriodDays: number,
    at: Date = now(),
  ): Promise<{ id: string; email: string; deletedAt: Date }[]> {
    const cutoff = subtractDays(gracePeriodDays, at);
    const rows = await this.db
      .select({ id: user.id, email: user.email, deletedAt: user.deletedAt })
      .from(user)
      .where(and(isNotNull(user.deletedAt), lt(user.deletedAt, cutoff)));
    return rows.filter(
      (row): row is { id: string; email: string; deletedAt: Date } => row.deletedAt != null,
    );
  }

  async findByIdForUpdate(id: string) {
    // FOR NO KEY UPDATE는 계정 변경을 직렬화하면서 이 User를 참조하는 FK 검사는 막지 않는다.
    const [row] = await this.db
      .select({ id: user.id, email: user.email, status: user.status, deletedAt: user.deletedAt })
      .from(user)
      .where(eq(user.id, id))
      .limit(1)
      .for("no key update");
    return row ?? null;
  }

  async hardDelete(id: string): Promise<void> {
    const deleted = await this.db.delete(user).where(eq(user.id, id)).returning({ id: user.id });
    requireRecord(deleted[0]);
  }

  private async update(id: string, patch: Partial<UserInsert>): Promise<UserRow> {
    const [row] = await this.db.update(user).set(patch).where(eq(user.id, id)).returning();
    return requireRecord(row);
  }
}
