/**
 * TTL로 풀리는 잠금. 인메모리 ↔ Redis 어댑터를 바꿔 끼운다. 업무 트랜잭션 잠금은 MutationLockPort다.
 *
 * 장애 계약 (모든 어댑터가 지켜야 함 — fail-closed):
 * - acquire는 백엔드 장애 시 null(busy와 동일)을 반환한다. 소비처는
 *   busy 경로(스킵/재시도)만 준비하면 장애를 따로 처리할 필요가 없다.
 * - release는 백엔드 장애 시 조용히 무시한다 — TTL 자동 만료가 정리한다.
 * - isLocked는 백엔드 장애 시 true(잠김)를 반환한다.
 *
 * fail-open(장애인데 획득 성공 취급)은 중복 알림 발송, 웹훅 동시 처리
 * 같은 사고로 이어지므로 금지한다.
 */
export abstract class LockProviderPort {
  /** 잠그면 release 함수를, 이미 잠겨 있으면 null을 돌려준다. ttlMs가 지나면 저절로 풀린다. */
  abstract acquire(resource: string, ttlMs: number): Promise<(() => Promise<void>) | null>;
  abstract isLocked(resource: string): Promise<boolean>;
}
