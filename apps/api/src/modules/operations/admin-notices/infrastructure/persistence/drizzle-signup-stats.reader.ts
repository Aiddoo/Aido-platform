import { TransactionHost } from "@nestjs-cls/transactional";
import { Injectable } from "@nestjs/common";
import { and, count, eq, exists, gte, lt, sql } from "drizzle-orm";

import type { DrizzleTransactionalAdapter } from "#api/platform/database/database.client";
import { account, user } from "#api/platform/database/schema/index";

import {
  type SignupStats,
  SignupStatsReaderPort,
} from "../../application/ports/signup-stats.reader.port.js";

/**
 * Drizzle 가입 통계 리더.
 *
 * Account.provider별 가입자 수와 총 사용자 수를 조회한다.
 */
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

  async getSignupStats(start: Temporal.Instant, end: Temporal.Instant): Promise<SignupStats> {
    const signupsByProvider = await this.#db
      .select({ provider: account.provider, count: count() })
      .from(account)
      .where(and(gte(account.createdAt, start), lt(account.createdAt, end)))
      .groupBy(account.provider);

    // 플랫폼 내부 FK용 사용자는 가입자가 아니다. 실제 인증 계정이 생긴 사용자만 센다.
    const totalUsers = await this.#db.$count(
      user,
      exists(
        this.#db
          .select({ one: sql`1` })
          .from(account)
          .where(eq(account.userId, user.id)),
      ),
    );

    return { signupsByProvider, totalUsers };
  }
}
