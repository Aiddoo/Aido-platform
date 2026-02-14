/**
 * 분산 잠금 인터페이스
 *
 * Strategy Pattern + Dependency Injection으로 인메모리 ↔ Redis 전환 가능
 */

export const LOCK_PROVIDER = Symbol("LOCK_PROVIDER");

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
	acquire(
		resource: string,
		ttlMs: number,
	): Promise<(() => Promise<void>) | null>;

	/**
	 * 리소스가 현재 잠겨있는지 확인합니다.
	 *
	 * @param resource 잠금 대상 리소스 식별자
	 * @returns 잠겨있으면 true, 아니면 false
	 */
	isLocked(resource: string): Promise<boolean>;
}
