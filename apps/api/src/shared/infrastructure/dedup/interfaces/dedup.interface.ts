/**
 * 중복 방지 인터페이스
 *
 * Strategy Pattern + Dependency Injection으로 인메모리 ↔ Redis 전환 가능
 *
 * Redis Set 기반으로 "이미 처리된" 항목을 빠르게 확인합니다.
 * DB partial unique index와 함께 사용하여 이중 방어선을 구성합니다.
 */

export const DEDUP_PROVIDER = Symbol("DEDUP_PROVIDER");

export interface IDedupProvider {
	/**
	 * 배치 멤버십 확인 — Set에 이미 존재하는 멤버만 반환
	 *
	 * @param setKey Set 키 (DedupKeys에서 생성)
	 * @param members 확인할 멤버 목록
	 * @returns Set에 존재하는 멤버들의 Set
	 *
	 * @example
	 * const notified = await dedup.filterMembers(
	 *   DedupKeys.notified('MORNING_REMINDER', today),
	 *   [DedupKeys.SENTINEL, ...userIds],
	 * );
	 */
	filterMembers(setKey: string, members: string[]): Promise<Set<string>>;

	/**
	 * 단건 멤버십 확인
	 *
	 * @param setKey Set 키
	 * @param member 확인할 멤버
	 * @returns 존재 여부
	 *
	 * @example
	 * const sent = await dedup.isMember(
	 *   DedupKeys.winbackStages(userId),
	 *   'day7',
	 * );
	 */
	isMember(setKey: string, member: string): Promise<boolean>;

	/**
	 * 멤버 추가 (TTL 자동 설정/갱신)
	 *
	 * @param setKey Set 키
	 * @param members 추가할 멤버 목록
	 * @param ttlMs TTL (밀리초) — PEXPIRE로 갱신
	 *
	 * @example
	 * await dedup.addMembers(
	 *   DedupKeys.notified('MORNING_REMINDER', today),
	 *   [DedupKeys.SENTINEL, ...userIds],
	 *   DedupKeys.TTL.NOTIFIED,
	 * );
	 */
	addMembers(setKey: string, members: string[], ttlMs: number): Promise<void>;
}
