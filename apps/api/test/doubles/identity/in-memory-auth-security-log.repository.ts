import {
  AuthSecurityLogRepositoryPort,
  type NewSecurityLog,
} from "#api/modules/identity/auth/application/ports/auth-security-log.repository.port";

/** 저장된 감사 기록. 사용자 id는 테이블 칸처럼 문자열이다 */
export type SecurityLogRecord = Omit<NewSecurityLog, "userId"> & { readonly userId?: string };

export function toSecurityLogRecord(entry: NewSecurityLog): SecurityLogRecord {
  const { userId, ...rest } = entry;
  return userId == null ? rest : { ...rest, userId: userId.value };
}

export class InMemoryAuthSecurityLogRepository extends AuthSecurityLogRepositoryPort {
  readonly entries: SecurityLogRecord[] = [];

  async create(entry: NewSecurityLog): Promise<void> {
    this.entries.push(toSecurityLogRecord(entry));
  }
}
