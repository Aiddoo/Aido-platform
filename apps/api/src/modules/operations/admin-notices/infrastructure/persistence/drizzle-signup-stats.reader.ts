import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, asc, count, eq, exists, gte, isNull, lt, sql } from "drizzle-orm";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { account, user } from "#api/platform/database/schema/index";

import {
  type SignupStats,
  SignupStatsReaderPort,
} from "../../application/ports/signup-stats.reader.port.js";

@Injectable()
export class DrizzleSignupStatsReader extends SignupStatsReaderPort {
  readonly #txHost: TransactionHost<DrizzleTransactionalAdapter>;

  constructor(txHost: TransactionHost<DrizzleTransactionalAdapter>) {
    super();
    this.#txHost = txHost;
  }

  get #db() {
    return this.#txHost.tx;
  }

  // 가입은 그날 만들어진 사용자이고 가입 방식은 그 사용자의 첫 계정이다(가입 알림과 같은 기준).
  // 기존 사용자가 다른 공급자를 연동해 생긴 계정은 가입으로 세지 않는다.
  async getSignupStats(start: Temporal.Instant, end: Temporal.Instant): Promise<SignupStats> {
    const firstAccount = this.#db
      .selectDistinctOn([account.userId], { userId: account.userId, provider: account.provider })
      .from(account)
      .orderBy(account.userId, asc(account.createdAt), asc(account.id))
      .as("first_account");

    const signupsByProvider = await this.#db
      .select({ provider: firstAccount.provider, count: count() })
      .from(user)
      .innerJoin(firstAccount, eq(firstAccount.userId, user.id))
      .where(and(gte(user.createdAt, start), lt(user.createdAt, end)))
      .groupBy(firstAccount.provider);

    // 플랫폼 내부 FK용 사용자(인증 계정 없음)와 탈퇴한 사용자는 전체 사용자에서 뺀다
    const totalUsers = await this.#db.$count(
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

    return { signupsByProvider, totalUsers };
  }
}
