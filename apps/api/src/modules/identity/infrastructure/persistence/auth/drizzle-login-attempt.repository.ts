import { Inject, Injectable } from "@nestjs/common";
import { and, eq, gte, lt } from "drizzle-orm";

import { requireRecord } from "#api/platform/database/database-error.util";
import { type Database, DRIZZLE } from "#api/platform/database/database.client";
import { loginAttempt } from "#api/platform/database/schema/index";
import { subtractDays } from "#api/shared/domain/date/utils/arithmetic";

type LoginAttemptRow = typeof loginAttempt.$inferSelect;

@Injectable()
export class DrizzleLoginAttemptRepository {
  // 로그인 시도는 호출자의 트랜잭션이 롤백돼도 남아야 하므로 활성 트랜잭션을 우회하는 베이스 클라이언트를 쓴다.
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /**
   * 로그인 시도 기록 생성
   *
   * Rate limiting 및 보안 분석을 위해 모든 로그인 시도를 기록합니다.
   *
   * @param data.email - 로그인 시도한 이메일
   * @param data.provider - 인증 방식 (CREDENTIAL, KAKAO, APPLE, GOOGLE, NAVER)
   *                        OAuth 로그인의 경우 해당 provider, 이메일 로그인은 CREDENTIAL
   * @param data.ipAddress - 클라이언트 IP 주소
   * @param data.userAgent - 클라이언트 User-Agent
   * @param data.success - 로그인 성공 여부
   * @param data.failureReason - 실패 사유 (실패 시)
   * @returns 생성된 LoginAttempt 레코드
   */
  async create(data: {
    email: string;
    provider?: LoginAttemptRow["provider"];
    ipAddress: string;
    userAgent: string;
    success: boolean;
    failureReason?: string;
  }): Promise<LoginAttemptRow> {
    const [row] = await this.db
      .insert(loginAttempt)
      .values({
        email: data.email,
        provider: data.provider,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        success: data.success,
        failureReason: data.failureReason,
      })
      .returning();
    return requireRecord(row);
  }

  async countRecentFailuresByEmail(email: string, since: Date): Promise<number> {
    return this.db.$count(
      loginAttempt,
      and(
        eq(loginAttempt.email, email),
        eq(loginAttempt.success, false),
        gte(loginAttempt.createdAt, since),
      ),
    );
  }

  async countRecentFailuresByIp(ipAddress: string, since: Date): Promise<number> {
    return this.db.$count(
      loginAttempt,
      and(
        eq(loginAttempt.ipAddress, ipAddress),
        eq(loginAttempt.success, false),
        gte(loginAttempt.createdAt, since),
      ),
    );
  }

  async findLastSuccessByEmail(email: string): Promise<LoginAttemptRow | null> {
    const row = await this.db.query.loginAttempt.findFirst({
      where: { email, success: true },
      orderBy: { createdAt: "desc" },
    });
    return row ?? null;
  }

  async findLastFailureByEmail(email: string): Promise<LoginAttemptRow | null> {
    const row = await this.db.query.loginAttempt.findFirst({
      where: { email, success: false },
      orderBy: { createdAt: "desc" },
    });
    return row ?? null;
  }

  // 감사 로그 목적으로 삭제하지 않음
  async clearRecentFailuresByEmail(_email: string, _since: Date): Promise<void> {
    // 감사 로그 목적으로 삭제하지 않음
    // 필요시 별도 플래그 추가 가능
  }

  // 배치 작업용, 30일 보관
  async deleteOld(retentionDays = 30): Promise<number> {
    const cutoff = subtractDays(retentionDays);
    const deleted = await this.db
      .delete(loginAttempt)
      .where(lt(loginAttempt.createdAt, cutoff))
      .returning({ id: loginAttempt.id });
    return deleted.length;
  }
}
