import type { AdminNoticeUser } from "../read-models/admin-notice.read-model.js";

export const ADMIN_NOTICE_USER_READER = Symbol("ADMIN_NOTICE_USER_READER");

/**
 * 관리자 알림의 사용자 블록 조회. 업무 트랜잭션이 커밋된 뒤 알림을 큐에 넣기 직전에 읽는다.
 */
export interface AdminNoticeUserReaderPort {
  /** 지워졌거나 없는 사용자면 null */
  findById(userId: string): Promise<AdminNoticeUser | null>;
}
