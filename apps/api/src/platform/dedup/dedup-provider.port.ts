/**
 * "이미 처리한" 항목을 TTL이 있는 집합으로 빠르게 거른다. 인메모리 ↔ Redis 어댑터를 바꿔 끼운다.
 * DB partial unique index와 함께 쓰는 두 번째 방어선이라 장애 때는 아무것도 거르지 않는다(fail-open).
 */
export abstract class DedupProviderPort {
  /** members 중 집합에 이미 있는 것만 돌려준다. setKey는 소비 slice의 keyspace가 만든다. */
  abstract filterMembers(setKey: string, members: string[]): Promise<Set<string>>;
  abstract isMember(setKey: string, member: string): Promise<boolean>;
  /** 더하면서 집합의 TTL을 ttlMs로 갱신한다. */
  abstract addMembers(setKey: string, members: string[], ttlMs: number): Promise<void>;
}
