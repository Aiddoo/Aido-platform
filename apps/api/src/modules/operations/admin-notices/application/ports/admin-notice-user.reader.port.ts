import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { AdminNoticeUser } from "../read-models/admin-notice.read-model.js";

/** 관리자 알림의 사용자 블록 조회. 업무 트랜잭션이 커밋된 뒤 알림을 큐에 넣기 직전에 읽는다. */
export abstract class AdminNoticeUserReaderPort {
  /** 지워졌거나 없는 사용자면 null */
  abstract findById(userId: UserId): Promise<AdminNoticeUser | null>;
}
