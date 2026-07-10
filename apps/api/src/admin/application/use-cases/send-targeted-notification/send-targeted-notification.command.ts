import type { NotificationAction } from "@aido/validators";
import { Command } from "@nestjs/cqrs";
import type { BroadcastResult } from "../../../domain/broadcast-result";

/**
 * 특정 사용자 알림 발송 커맨드.
 *
 * 존재하는 사용자만 필터링해 발송한다. 유효 대상이 없으면 ADMIN_1402.
 */
export class SendTargetedNotificationCommand extends Command<BroadcastResult> {
	constructor(
		public readonly title: string,
		public readonly body: string,
		public readonly userIds: string[],
		public readonly action: NotificationAction | undefined,
	) {
		super();
	}
}
