import { ACCOUNT_DELETION } from "@aido/api/vocabulary";
import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable, Logger } from "@nestjs/common";
import { and, eq, inArray, isNotNull, isNull, lt, ne, sql } from "drizzle-orm";

import { AuthPersistenceConflict } from "#api/modules/identity/auth/application/auth.errors";
import { AuthLogEvent } from "#api/modules/identity/auth/application/auth.log-events";
import type { AuthUserActivityWriterPort } from "#api/modules/identity/auth/application/ports/auth-collaboration.port";
import {
  type AuthUserProfileRecord,
  AuthUserRepositoryPort,
} from "#api/modules/identity/auth/application/ports/auth-user.repository.port";
import type {
  UserActivity,
  UserActivityReaderPort,
} from "#api/modules/identity/users/application/ports/user-activity.reader.port";
import type { UserAppVersionReaderPort } from "#api/modules/identity/users/application/ports/user-app-version.reader.port";
import { requireRecord, uniqueConstraintTargets } from "#api/platform/database/database-error.util";
import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import {
  user,
  userActivityDay,
  userPreference,
  userProfile,
} from "#api/platform/database/schema/index";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { localDateIn } from "#api/shared/domain/time/time-zone-name";

import type { UserStatus } from "../../../auth/domain/auth.constants.js";
import { toIdentityUser } from "../../../auth/infrastructure/persistence/auth-row.mapper.js";
import { userTagCollided, userTagGenerationFailed } from "../../application/users.errors.js";
import type { IdentityUser } from "../../domain/identity-user.aggregate.js";
import { generateUserTag } from "./user-tag.adapter.js";

type UserInsert = typeof user.$inferInsert;

export interface UserWithProfile extends AuthUserProfileRecord {
  lastLoginAt: Temporal.Instant | null;
}

const MAX_USER_TAG_RETRIES = 5;
// 탈퇴 유예는 UTC 기준 일수다(UTC에는 일광 절약이 없어 24시간 단위와 같다)
const PURGE_GRACE_PERIOD = Temporal.Duration.from({
  hours: 24 * ACCOUNT_DELETION.GRACE_PERIOD_DAYS,
});

// 같은 인스턴스가 활동 기록·앱 버전·활동 조회 포트로도 쓰여(useExisting) implements로 서명을 함께 검사한다
@Injectable()
export class DrizzleUserRepository
  extends AuthUserRepositoryPort
  implements AuthUserActivityWriterPort, UserAppVersionReaderPort, UserActivityReaderPort
{
  readonly #logger = new Logger(DrizzleUserRepository.name);

  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;
  readonly #clock: ClockPort;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>, clock: ClockPort) {
    super();
    this.#txHost = txHost;
    this.#clock = clock;
  }

  get #db() {
    return this.#txHost.tx;
  }

  async findByEmail(email: string): Promise<IdentityUser | null> {
    const row = await this.#db.query.user.findFirst({ where: { email } });
    return row == null ? null : toIdentityUser(row);
  }

  async findById(id: UserId): Promise<IdentityUser | null> {
    const row = await this.#db.query.user.findFirst({ where: { id: id.value } });
    return row == null ? null : toIdentityUser(row);
  }

  async findByIdWithProfile(id: UserId): Promise<UserWithProfile | null> {
    const row = await this.#db.query.user.findFirst({
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
      where: { id: id.value },
      with: {
        profile: { columns: { name: true, profileImage: true } },
        accounts: { columns: { provider: true } },
      },
    });
    return row ?? null;
  }

  async create(data: {
    readonly email: string;
    readonly status: UserStatus;
    readonly emailVerifiedAt?: Temporal.Instant;
  }): Promise<IdentityUser> {
    const userTag = await this.#generateUniqueUserTag();

    try {
      const [row] = await this.#db
        .insert(user)
        .values({
          email: data.email,
          status: data.status,
          emailVerifiedAt: data.emailVerifiedAt,
          userTag,
          updatedAt: this.#clock.now(),
        })
        .returning();
      return toIdentityUser(requireRecord(row));
    } catch (error) {
      const targets = uniqueConstraintTargets(error);
      if (targets?.includes("email")) {
        throw new AuthPersistenceConflict("EMAIL_ALREADY_EXISTS");
      }
      // 확인 뒤 다른 가입이 같은 태그를 먼저 넣었다. 1.15.0 필터가 이 제약에 주던 500 응답을 유지한다
      if (targets?.includes("userTag")) {
        throw userTagCollided(error);
      }
      throw error;
    }
  }

  async #generateUniqueUserTag(): Promise<string> {
    for (let i = 0; i < MAX_USER_TAG_RETRIES; i++) {
      const tag = generateUserTag();
      const exists = await this.#db.query.user.findFirst({
        columns: { id: true },
        where: { userTag: tag },
      });

      if (!exists) {
        return tag;
      }

      this.#logger.warn({ event: AuthLogEvent.USER_TAG_COLLIDED, attempt: i + 1 });
    }

    throw userTagGenerationFailed(MAX_USER_TAG_RETRIES);
  }

  async markEmailVerified(id: UserId, now: Temporal.Instant): Promise<void> {
    await this.#update(id.value, { emailVerifiedAt: now, status: "ACTIVE", updatedAt: now });
  }

  async findActiveAccounts(userIds: readonly UserId[]): Promise<readonly UserActivity[]> {
    if (userIds.length === 0) {
      return [];
    }
    const rows = await this.#db
      .select({
        userId: user.id,
        lastActiveAt: user.lastActiveAt,
        signedUpAt: user.createdAt,
        timezone: userPreference.timezone,
      })
      .from(user)
      .leftJoin(userPreference, eq(userPreference.userId, user.id))
      .where(
        and(
          inArray(
            user.id,
            userIds.map((userId) => userId.value),
          ),
          isNull(user.deletedAt),
          ne(user.status, "SUSPENDED"),
        ),
      );
    return rows;
  }

  async findLastSeenAppVersion(userId: UserId): Promise<string | null> {
    const row = await this.#db.query.user.findFirst({
      columns: { lastSeenAppVersion: true },
      where: { id: userId.value },
    });
    return row?.lastSeenAppVersion ?? null;
  }

  async updateLastActiveAt(
    activity: Parameters<AuthUserActivityWriterPort["updateLastActiveAt"]>[0],
  ): Promise<void> {
    const { timezone, appVersion, seenAt } = activity;
    const id = activity.userId.value;
    const localDate = localDateIn(seenAt, timezone);

    await this.#db.execute(sql`
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
    userId: UserId,
    data: { name?: string; profileImage?: string },
  ): Promise<void> {
    await this.#db.insert(userProfile).values({
      userId: userId.value,
      name: data.name ?? null,
      profileImage: data.profileImage ?? null,
    });
  }

  async updateProfile(
    userId: UserId,
    data: { name?: string | null; profileImage?: string | null },
  ): Promise<{ name: string | null; profileImage: string | null }> {
    // upsert로 프로필이 없는 경우에도 생성
    const [profile] = await this.#db
      .insert(userProfile)
      .values({
        userId: userId.value,
        name: data.name ?? null,
        profileImage: data.profileImage ?? null,
      })
      .onConflictDoUpdate({
        target: userProfile.userId,
        // PATCH라 undefined는 그대로 두고 null은 비운다. userId는 빈 set을 피하는 무변경 값이다.
        set: { userId: userId.value, name: data.name, profileImage: data.profileImage },
      })
      .returning({ name: userProfile.name, profileImage: userProfile.profileImage });
    return requireRecord(profile);
  }

  async saveAccountStatus(identityUser: IdentityUser): Promise<void> {
    const { status, deletedAt } = identityUser.toPrimitives();
    await this.#update(identityUser.id.value, {
      status,
      deletedAt,
      updatedAt: this.#clock.now(),
    });
  }

  async listPurgeEligible(now: Temporal.Instant): Promise<IdentityUser[]> {
    const cutoff = now.subtract(PURGE_GRACE_PERIOD);
    const rows = await this.#db
      .select()
      .from(user)
      .where(and(isNotNull(user.deletedAt), lt(user.deletedAt, cutoff)));
    return rows.map(toIdentityUser);
  }

  async findByIdForUpdate(id: UserId): Promise<IdentityUser | null> {
    // FOR NO KEY UPDATE는 계정 변경을 직렬화하면서 이 User를 참조하는 FK 검사는 막지 않는다.
    const [row] = await this.#db
      .select()
      .from(user)
      .where(eq(user.id, id.value))
      .limit(1)
      .for("no key update");
    return row == null ? null : toIdentityUser(row);
  }

  async hardDelete(id: UserId): Promise<void> {
    const deleted = await this.#db
      .delete(user)
      .where(eq(user.id, id.value))
      .returning({ id: user.id });
    requireRecord(deleted[0]);
  }

  async #update(
    id: string,
    patch: Partial<UserInsert> & Pick<UserInsert, "updatedAt">,
  ): Promise<void> {
    const [row] = await this.#db
      .update(user)
      .set(patch)
      .where(eq(user.id, id))
      .returning({ id: user.id });
    requireRecord(row);
  }
}
