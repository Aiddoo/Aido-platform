import type { NotificationAction } from "@aido/validators";
import { Command } from "@nestjs/cqrs";
import type { BroadcastResult } from "../../../domain/broadcast";
import type { BroadcastTargetFilter } from "../../ports/admin-user-directory.port";

/**
 * 전체/조건부 알림 브로드캐스트 커맨드.
 *
 * 대상 필터에 해당하는 사용자에게 알림을 발송한다. 대상이 없으면 ADMIN_1402.
 */
export class BroadcastNotificationCommand extends Command<BroadcastResult> {
	constructor(
		public readonly title: string,
		public readonly body: string,
		public readonly targetFilter: BroadcastTargetFilter,
		public readonly action: NotificationAction | undefined,
	) {
		super();
	}
}
