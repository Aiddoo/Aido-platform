import type { AdminBroadcastMessage } from "../../domain/broadcast-message";

/** AdminBroadcastNotifierPort DI 토큰 */
export const ADMIN_BROADCAST_NOTIFIER = Symbol("ADMIN_BROADCAST_NOTIFIER");

/**
 * 관리자 브로드캐스트 발송 포트.
 *
 * 다수 알림을 한 배치로 생성·발송한다. 실제 발송(NotificationService/푸시)은
 * 인프라 어댑터가 담당하며, 어댑터만 교체하면 발송 수단을 바꿀 수 있다.
 * 테스트는 스텁으로 대체해 실제 발송을 막는다.
 */
export interface AdminBroadcastNotifierPort {
	sendBatch(messages: AdminBroadcastMessage[]): Promise<{ count: number }>;
}
