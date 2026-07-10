/**
 * NudgeNotifierPort — 콕 찌르기 알림 발행 포트.
 *
 * 콕 찌르기 전송 시 내구성 있는 부수효과로 BullMQ 큐에 enqueue한다(커밋 후, fire-and-forget).
 * 미이관 notification 모듈의 큐 서비스를 감싼 위임 어댑터가 구현한다. 리마인드 콕 찌르기는
 * 특정 할 일에 묶이지 않으므로 todoId·todoTitle 없이 발행된다.
 */

export interface NudgeSentNotification {
	nudgeId: number;
	senderId: string;
	receiverId: string;
	senderName: string;
	todoId?: number;
	todoTitle?: string;
	message?: string;
}

export const NUDGE_NOTIFIER = Symbol("NUDGE_NOTIFIER");

export interface NudgeNotifierPort {
	notifyNudgeSent(payload: NudgeSentNotification): void;
}
