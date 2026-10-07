import { userStatusSchema } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";
import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable, Logger } from "@nestjs/common";
import { and } from "@prisma/orm-postgres/orm-client";
import { param } from "@prisma/orm-postgres/relational-core/expression";
import sql from "sql-template-tag";

import {
  type AuthAccountLifecycleRepositoryPort,
  AuthPersistenceConflict,
  type AuthUserProfileRecord,
  type AuthUserRepositoryPort,
} from "#api/modules/identity/application/ports/auth/auth-persistence.port";
import type { DatabaseCreate } from "#api/platform/database/database-records";
import { decodeRecord, encodeCreate, encodePatch } from "#api/platform/database/database-records";
import { decodeSqlRows, sqlRowSpec, sqlStatement } from "#api/platform/database/database-sql";
import { databaseDate, databaseTimestamp, varchar } from "#api/platform/database/database-values";
import type { User, UserStatus } from "#api/platform/database/database.types";
import { requireRecord } from "#api/platform/database/prisma-error.util";
import { uniqueConstraintTargets } from "#api/platform/database/prisma-error.util";
import type { Prisma8TransactionalAdapter } from "#api/platform/database/prisma8-transactional.adapter";
import { subtractDays } from "#api/shared/domain/date/utils/arithmetic";
import { now } from "#api/shared/domain/date/utils/core";
import { startOfDayInTimezone } from "#api/shared/domain/date/utils/timezone";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import { generateUserTag } from "./user-tag.generator.js";

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
export class UserRepository implements AuthUserRepositoryPort, AuthAccountLifecycleRepositoryPort {
  readonly #logger = new Logger(UserRepository.name);
  private static readonly MAX_USER_TAG_RETRIES = 5;

  constructor(private readonly txHost: TransactionHost<Prisma8TransactionalAdapter>) {}

  /** 활성 트랜잭션(없으면 베이스 클라이언트) */
  private get client() {
    return this.txHost.tx;
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.client.orm.public.User.where((row) => row.email.eq(varchar(email, 255)))
      .first()
      .then((row) => decodeRecord("User", row));
  }

  async findByEmailWithCredential(email: string): Promise<UserWithAccount | null> {
    return this.client.orm.public.User.where((row) => row.email.eq(varchar(email, 255)))
      .select("id", "email", "status", "emailVerifiedAt")
      .include("accounts", (related) =>
        related.where((row) => row.provider.eq("CREDENTIAL")).select("id", "provider", "password"),
      )
      .first()
      .then((row) => decodeRecord("User", row));
  }

  async findById(id: string): Promise<User | null> {
    return this.client.orm.public.User.where((row) => row.id.eq(id))
      .first()
      .then((row) => decodeRecord("User", row));
  }

  async findByIdWithProfile(id: string): Promise<UserWithProfile | null> {
    return this.client.orm.public.User.where((row) => row.id.eq(id))
      .select(
        "id",
        "email",
        "userTag",
        "role",
        "status",
        "emailVerifiedAt",
        "subscriptionStatus",
        "subscriptionExpiresAt",
        "createdAt",
        "deletedAt",
        "lastLoginAt",
      )
      .include("profile", (related) => related.select("name", "profileImage"))
      .include("accounts", (related) => related.select("provider"))
      .first()
      .then((row) => decodeRecord("User", row));
  }

  async existsByEmail(email: string): Promise<boolean> {
    const count = (
      await this.client.orm.public.User.where((row) => row.email.eq(varchar(email, 255))).aggregate(
        (aggregate) => ({ count: aggregate.count() }),
      )
    ).count;
    return count > 0;
  }

  // userTag가 없으면 자동 생성 (중복 시 재시도)
  async create(
    data: Omit<DatabaseCreate<"User">, "userTag"> & {
      userTag?: string;
    },
  ): Promise<User> {
    // userTag가 제공되지 않으면 자동 생성
    const userTag = data.userTag ?? (await this.#generateUniqueUserTag());

    try {
      return decodeRecord(
        "User",
        await this.client.orm.public.User.create(
          encodeCreate("User", {
            ...data,
            userTag,
          }),
        ),
      );
    } catch (error) {
      if (uniqueConstraintTargets(error)?.includes("email")) {
        throw new AuthPersistenceConflict("EMAIL_ALREADY_EXISTS");
      }
      throw error;
    }
  }

  async #generateUniqueUserTag(): Promise<string> {
    for (let i = 0; i < UserRepository.MAX_USER_TAG_RETRIES; i++) {
      const tag = generateUserTag();
      const exists = decodeRecord(
        "User",
        await this.client.orm.public.User.where((row) => row.userTag.eq(varchar(tag, 8)))
          .select("id")
          .first(),
      );

      if (!exists) {
        return tag;
      }

      this.#logger.warn(`User tag collision detected: ${tag}, retrying...`);
    }

    // 모든 재시도 실패 시 (극히 드문 경우)
    throw new ApplicationException(ErrorCode.USER_0611, {
      attempts: UserRepository.MAX_USER_TAG_RETRIES,
    });
  }

  async updateStatus(id: string, status: UserStatus): Promise<User> {
    return this.client.orm.public.User.where((row) => row.id.eq(id))
      .update(encodePatch("User", { status }))
      .then((row) => decodeRecord("User", requireRecord(row)));
  }

  async markEmailVerified(id: string): Promise<User> {
    return this.client.orm.public.User.where((row) => row.id.eq(id))
      .update(
        encodePatch("User", {
          emailVerifiedAt: now(),
          status: "ACTIVE",
        }),
      )
      .then((row) => decodeRecord("User", requireRecord(row)));
  }

  async updateLastActiveAt(id: string, timezone: string): Promise<void> {
    const seenAt = now();
    const localDate = startOfDayInTimezone(seenAt, timezone);

    const plan = this.client.raw.sql`
			WITH updated_user AS (
				UPDATE "User" AS app_user
				SET
					"lastActiveAt" = GREATEST(
						COALESCE(app_user."lastActiveAt", ${param(databaseTimestamp(seenAt), { codecId: "pg/timestamp-string@1" })}),
						${param(databaseTimestamp(seenAt), { codecId: "pg/timestamp-string@1" })}
					),
					"updatedAt" = GREATEST(app_user."updatedAt", ${param(databaseTimestamp(seenAt), { codecId: "pg/timestamp-string@1" })})
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
				${databaseDate(localDate)}::DATE,
				${timezone},
				${param(databaseTimestamp(seenAt), { codecId: "pg/timestamp-string@1" })},
				${param(databaseTimestamp(seenAt), { codecId: "pg/timestamp-string@1" })}
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
		`
      .affectedCount()
      .build();
    await this.client.execute(plan);
  }

  async createProfile(
    userId: string,
    data: { name?: string; profileImage?: string },
  ): Promise<void> {
    decodeRecord(
      "UserProfile",
      await this.client.orm.public.UserProfile.create(
        encodeCreate("UserProfile", {
          userId,
          name: data.name ?? null,
          profileImage: data.profileImage ?? null,
        }),
      ),
    );
  }

  async updateProfile(
    userId: string,
    data: { name?: string | null; profileImage?: string | null },
  ): Promise<{ name: string | null; profileImage: string | null }> {
    // upsert로 프로필이 없는 경우에도 생성
    const profile = decodeRecord(
      "UserProfile",
      await this.client.orm.public.UserProfile.where((row) => row.userId.eq(userId))
        .select("name", "profileImage")
        .upsert({
          conflictOn: encodePatch("UserProfile", { userId }),
          create: encodeCreate("UserProfile", {
            userId,
            name: data.name ?? null,
            profileImage: data.profileImage ?? null,
          }),
          update: encodePatch("UserProfile", {
            ...(data.name !== undefined && { name: data.name }),
            ...(data.profileImage !== undefined && {
              profileImage: data.profileImage,
            }),
          }),
        }),
    );

    return profile;
  }

  async softDelete(id: string, deletedAt: Date = now()): Promise<User> {
    return this.client.orm.public.User.where((row) => row.id.eq(id))
      .update(encodePatch("User", { deletedAt, status: "SUSPENDED" }))
      .then((row) => decodeRecord("User", requireRecord(row)));
  }

  async restore(id: string): Promise<User> {
    return this.client.orm.public.User.where((row) => row.id.eq(id))
      .update(encodePatch("User", { deletedAt: null, status: "ACTIVE" }))
      .then((row) => decodeRecord("User", requireRecord(row)));
  }

  async findSoftDeletedForPurge(
    gracePeriodDays: number,
    at: Date = now(),
  ): Promise<{ id: string; email: string; deletedAt: Date }[]> {
    const cutoff = subtractDays(gracePeriodDays, at);
    const rows = decodeRecord(
      "User",
      await this.client.orm.public.User.where((row) =>
        and(row.deletedAt.isNotNull(), row.deletedAt.lt(databaseTimestamp(cutoff))),
      )
        .select("id", "email", "deletedAt")
        .all(),
    );
    return rows.filter(
      (row): row is { id: string; email: string; deletedAt: Date } => row.deletedAt !== null,
    );
  }

  async findByIdForUpdate(id: string) {
    const rowSpec = sqlRowSpec({
      id: "pg/text@1",
      email: "pg/text@1",
      status: "pg/text@1",
      deletedAt: { codecId: "pg/timestamp-string@1", nullable: true },
    });
    const rows = decodeSqlRows(
      rowSpec,
      await this.client.query(
        sqlStatement(
          this.client,
          sql`SELECT "id", "email", "status"::text AS "status", "deletedAt"
            FROM "User" WHERE "id" = ${id} FOR NO KEY UPDATE`,
        )
          .returnsRow(rowSpec)
          .build(),
      ),
    );
    const row = rows[0];
    return row === undefined ? null : { ...row, status: userStatusSchema.parse(row.status) };
  }

  async hardDelete(id: string): Promise<void> {
    decodeRecord(
      "User",
      requireRecord(await this.client.orm.public.User.where((row) => row.id.eq(id)).delete()),
    );
  }
}
