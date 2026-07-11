/**
 * CheerNotifierPort — 응원 알림 발행 포트.
 *
 * 응원 전송 시 내구성 있는 부수효과로 BullMQ 큐에 enqueue한다(커밋 후, fire-and-forget).
 * 미이관 notification 모듈의 큐 서비스를 감싼 위임 어댑터가 구현한다.
 */

export interface CheerSentNotification {
	cheerId: number;
	senderId: string;
	receiverId: string;
	senderName: string;
	message?: string;
}

export const CHEER_NOTIFIER = Symbol("CHEER_NOTIFIER");

export interface CheerNotifierPort {
	notifyCheerSent(payload: CheerSentNotification): void;
}
