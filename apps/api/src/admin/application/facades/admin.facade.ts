import type { NotificationAction } from "@aido/validators";
import { Injectable } from "@nestjs/common";
import { CommandBus } from "@nestjs/cqrs";
import type { BroadcastResult } from "../../domain/broadcast";
import type { BroadcastTargetFilter } from "../ports/admin-user-directory.port";
import { BroadcastNotificationCommand } from "../use-cases/broadcast-notification/broadcast-notification.command";
import { SendTargetedNotificationCommand } from "../use-cases/send-targeted-notification/send-targeted-notification.command";

/**
 * 관리자 애플리케이션 서비스(Facade) — 컨트롤러와 CommandBus 사이의 얇은 seam.
 */
@Injectable()
export class AdminFacade {
	constructor(private readonly commandBus: CommandBus) {}

	broadcastNotification(
		title: string,
		body: string,
		targetFilter: BroadcastTargetFilter,
		action: NotificationAction | undefined,
	): Promise<BroadcastResult> {
		return this.commandBus.execute(
			new BroadcastNotificationCommand(title, body, targetFilter, action),
		);
	}

	sendTargetedNotification(
		title: string,
		body: string,
		userIds: string[],
		action: NotificationAction | undefined,
	): Promise<BroadcastResult> {
		return this.commandBus.execute(
			new SendTargetedNotificationCommand(title, body, userIds, action),
		);
	}
}
