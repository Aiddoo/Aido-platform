import type { AdminNotice } from "../../domain/admin-notice.aggregate.js";

/** 관리자 알림을 그 채널로 보내는 발송 작업을 큐에 등록한다. 중복 방지 key가 같은 작업은 한 번만 남는다. */
export abstract class AdminNotificationQueuePort {
  abstract enqueueSend(notice: AdminNotice): Promise<void>;
}
