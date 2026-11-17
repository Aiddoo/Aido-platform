import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, asc, count, eq, exists, gte, isNull, lt, sql } from "drizzle-orm";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { account, user, userProfile } from "#api/platform/database/schema/index";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { UserSignupReaderPort } from "../../application/ports/user-signup.reader.port.js";
import type {
  SignupCountReadModel,
  UserSignupReadModel,
} from "../../application/read-models/user-signup.read-model.js";

@Injectable()
export class DrizzleUserSignupReader extends UserSignupReaderPort {
  readonly #transactionHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(transactionHost: TransactionHost<DrizzleTransactionalAdapter>) {
    super();
    this.#transactionHost = transactionHost;
  }

  async findSignup(userId: UserId): Promise<UserSignupReadModel | null> {
    const [row] = await this.#db
      .select({
        id: user.id,
        email: user.email,
        userTag: user.userTag,
        createdAt: user.createdAt,
        name: userProfile.name,
      })
      .from(user)
      .leftJoin(userProfile, eq(userProfile.userId, user.id))
      .where(and(eq(user.id, userId.value), isNull(user.deletedAt)))
      .limit(1);
    if (row == null) {
      return null;
    }
    const [firstAccount] = await this.#db
      .select({ provider: account.provider })
      .from(account)
      .where(eq(account.userId, userId.value))
      .orderBy(asc(account.createdAt), asc(account.id))
      .limit(1);

    return {
      userId: UserId.reconstitute(row.id),
      email: row.email,
      userTag: row.userTag,
      name: row.name == null || row.name === "" ? null : row.name,
      signedUpAt: row.createdAt,
      signupMethod: firstAccount?.provider ?? null,
    };
  }

  // 가입은 그 구간에 만든 사용자이고 가입 방식은 그 사용자의 첫 계정이다(가입 알림과 같은 기준)
  async countSignupsByMethod(period: {
    readonly start: Temporal.Instant;
    readonly end: Temporal.Instant;
  }): Promise<SignupCountReadModel[]> {
    const firstAccount = this.#db
      .selectDistinctOn([account.userId], { userId: account.userId, provider: account.provider })
      .from(account)
      .orderBy(account.userId, asc(account.createdAt), asc(account.id))
      .as("first_account");

    const rows = await this.#db
      .select({ provider: firstAccount.provider, count: count() })
      .from(user)
      .innerJoin(firstAccount, eq(firstAccount.userId, user.id))
      .where(and(gte(user.createdAt, period.start), lt(user.createdAt, period.end)))
      .groupBy(firstAccount.provider);
    return rows.map((row) => ({ signupMethod: row.provider, count: row.count }));
  }

  countRegisteredUsers(): Promise<number> {
    return this.#db.$count(
      user,
      and(
        isNull(user.deletedAt),
        exists(
          this.#db
            .select({ one: sql`1` })
            .from(account)
            .where(eq(account.userId, user.id)),
        ),
      ),
    );
  }

  get #db() {
    return this.#transactionHost.tx;
  }
}
