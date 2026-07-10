import type { BroadcastTargetFilter } from "../../domain/broadcast-message";

/** AdminUserDirectoryPort DI 토큰 */
export const ADMIN_USER_DIRECTORY = Symbol("ADMIN_USER_DIRECTORY");

/**
 * 관리자 사용자 조회 포트 — 알림 대상 사용자 선별을 추상화한다.
 *
 * 필터→쿼리 변환(Prisma where 등)은 인프라 어댑터가 담당하며, application은
 * 대상 필터의 도메인 의미만 다룬다.
 */
export interface AdminUserDirectoryPort {
	/**
	 * 대상 필터에 해당하는 사용자 ID를 배치 단위로 스트리밍한다.
	 * (전체 대상을 메모리에 적재하지 않도록 커서 기반 페이지네이션)
	 */
	streamTargetUserIds(filter: BroadcastTargetFilter): AsyncIterable<string[]>;

	/** 주어진 ID 중 실제 존재(비삭제)하는 사용자 ID만 반환한다 */
	findExistingUserIds(userIds: string[]): Promise<string[]>;
}
