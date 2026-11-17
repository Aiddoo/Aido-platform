import {
  SecurityLogRepositoryPort,
  type NewSecurityLog,
} from "#api/modules/identity/users/application/ports/security-log.repository.port";
import { SystemClock } from "#api/platform/time/system-clock";

/** 저장된 감사 기록. 사용자 id는 테이블 칸처럼 문자열이다 */
export type SecurityLogRecord = Omit<NewSecurityLog, "userId"> & { readonly userId?: string };

interface StoredSecurityLog {
  readonly record: SecurityLogRecord;
  readonly recordedAt: Temporal.Instant;
}

export function toSecurityLogRecord(entry: NewSecurityLog): SecurityLogRecord {
  const { userId, ...rest } = entry;
  return userId == null ? rest : { ...rest, userId: userId.value };
}

export class InMemorySecurityLogRepository extends SecurityLogRepositoryPort {
  readonly #stored: StoredSecurityLog[] = [];
  // Drizzle 저장소처럼 기록 시각은 저장하는 순간의 시각이다(DB now())
  readonly #clock = new SystemClock();

  get entries(): readonly SecurityLogRecord[] {
    return this.#stored.map((stored) => stored.record);
  }

  // 테스트가 지난 시각의 기록을 놓는다. 포트의 create는 시각을 받지 않는다
  seed(entry: NewSecurityLog, recordedAt: Temporal.Instant): void {
    this.#stored.push({ record: toSecurityLogRecord(entry), recordedAt });
  }

  async create(entry: NewSecurityLog): Promise<void> {
    this.seed(entry, this.#clock.now());
  }

  async deleteRecordedBefore(cutoff: Temporal.Instant, limit: number): Promise<number> {
    const oldLogs = this.#stored
      .filter((stored) => Temporal.Instant.compare(stored.recordedAt, cutoff) < 0)
      .slice(0, limit);
    for (const stored of oldLogs) {
      this.#stored.splice(this.#stored.indexOf(stored), 1);
    }
    return oldLogs.length;
  }
}
