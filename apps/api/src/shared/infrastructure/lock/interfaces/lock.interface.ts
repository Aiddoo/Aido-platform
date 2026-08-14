/**
 * 분산 잠금 인터페이스
 *
 * Strategy Pattern + Dependency Injection으로 인메모리 ↔ Redis 전환 가능
 */

export const LOCK_PROVIDER = Symbol("LOCK_PROVIDER");

/**
 * 분산 잠금 포트
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
export interface ILockProvider {
	/**
	 * 리소스에 대한 잠금을 획득합니다.
	 *
	 * @param resource 잠금 대상 리소스 식별자
	 * @param ttlMs 잠금 유지 시간 (밀리초). TTL 만료 시 자동 해제
	 * @returns 잠금 성공 시 release 함수 반환, 이미 잠겨있으면 null 반환
	 *
	 * @example
	 * const release = await lock.acquire('todo:123:reminder', 5000);
	 * if (!release) return; // 이미 잠김
	 * try {
	 *   // 작업 수행
	 * } finally {
	 *   await release();
	 * }
	 */
	acquire(resource: string, ttlMs: number): Promise<(() => Promise<void>) | null>;

	/**
	 * 리소스가 현재 잠겨있는지 확인합니다.
	 *
	 * @param resource 잠금 대상 리소스 식별자
	 * @returns 잠겨있으면 true, 아니면 false
	 */
	isLocked(resource: string): Promise<boolean>;
}
