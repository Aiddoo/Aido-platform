import { Inject, Injectable } from "@nestjs/common";
import { and, eq, gte, inArray, lt } from "drizzle-orm";

import {
  LoginAttemptRepositoryPort,
  type NewLoginAttempt,
} from "#api/modules/identity/sessions/application/ports/login-attempt.repository.port";
import { type Database, DRIZZLE } from "#api/platform/database/database.client";
import { loginAttempt } from "#api/platform/database/schema/index";

@Injectable()
export class DrizzleLoginAttemptRepository extends LoginAttemptRepositoryPort {
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

  async deleteAttemptedBefore(cutoff: Temporal.Instant, limit: number): Promise<number> {
    const oldAttempts = this.#db
      .select({ id: loginAttempt.id })
      .from(loginAttempt)
      .where(lt(loginAttempt.createdAt, cutoff))
      .limit(limit);
    const deleted = await this.#db
      .delete(loginAttempt)
      .where(inArray(loginAttempt.id, oldAttempts))
      .returning({ id: loginAttempt.id });
    return deleted.length;
  }
}
