import type { NudgeReplyKind } from "@aido/validators";

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

interface NudgeInteractionNotificationBase {
	readonly nudgeId: number;
	readonly todoId: number;
	readonly actorId: string;
	readonly recipientId: string;
	readonly actorName: string;
	readonly todoTitle: string;
}

export type NudgeInteractionNotification = NudgeInteractionNotificationBase &
	({ readonly kind: "reply"; readonly replyKind: NudgeReplyKind } | { readonly kind: "thanks" });

export interface NudgeNotifierPort {
	notifyNudgeSent(payload: NudgeSentNotification): void;
	recordInteraction(payload: NudgeInteractionNotification): Promise<void>;
	recordInteractions(payloads: readonly NudgeInteractionNotification[]): Promise<void>;
}
