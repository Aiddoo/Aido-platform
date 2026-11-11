import { Inject, Injectable } from "@nestjs/common";
import { and, eq, gte } from "drizzle-orm";

import {
  AuthLoginAttemptRepositoryPort,
  type NewLoginAttempt,
} from "#api/modules/identity/auth/application/ports/auth-login-attempt.repository.port";
import { type Database, DRIZZLE } from "#api/platform/database/database.client";
import { loginAttempt } from "#api/platform/database/schema/index";

@Injectable()
export class DrizzleLoginAttemptRepository extends AuthLoginAttemptRepositoryPort {
  // 로그인 시도는 호출자의 트랜잭션이 롤백돼도 남아야 하므로 활성 트랜잭션을 우회하는 베이스 클라이언트를 쓴다.
  readonly #db: Database;

  constructor(@Inject(DRIZZLE) db: Database) {
    super();
    this.#db = db;
  }

  async create(attempt: NewLoginAttempt): Promise<void> {
    await this.#db.insert(loginAttempt).values({
      email: attempt.email,
      provider: attempt.provider,
      ipAddress: attempt.ipAddress,
      userAgent: attempt.userAgent,
      success: attempt.success,
      failureReason: attempt.failureReason,
      createdAt: attempt.attemptedAt,
    });
  }

  async countRecentFailuresByEmail(email: string, since: Temporal.Instant): Promise<number> {
    return this.#db.$count(
      loginAttempt,
      and(
        eq(loginAttempt.email, email),
        eq(loginAttempt.success, false),
        gte(loginAttempt.createdAt, since),
      ),
    );
  }
}
