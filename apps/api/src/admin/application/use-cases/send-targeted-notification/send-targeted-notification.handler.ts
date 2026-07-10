import { Inject, Logger } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { BusinessExceptions } from "@/shared/application/exceptions/business-exception.service";
import {
	type BroadcastResult,
	buildBroadcastResult,
	deriveBroadcastMetadata,
} from "../../../domain/broadcast";
import {
	ADMIN_BROADCAST_NOTIFIER,
	type AdminBroadcastNotifierPort,
} from "../../ports/admin-broadcast-notifier.port";
import {
	ADMIN_USER_DIRECTORY,
	type AdminUserDirectoryPort,
} from "../../ports/admin-user-directory.port";
import { SendTargetedNotificationCommand } from "./send-targeted-notification.command";

@CommandHandler(SendTargetedNotificationCommand)
export class SendTargetedNotificationHandler
	implements ICommandHandler<SendTargetedNotificationCommand, BroadcastResult>
{
	readonly #logger = new Logger(SendTargetedNotificationHandler.name);

	constructor(
		@Inject(ADMIN_USER_DIRECTORY)
		private readonly userDirectory: AdminUserDirectoryPort,
		@Inject(ADMIN_BROADCAST_NOTIFIER)
		private readonly notifier: AdminBroadcastNotifierPort,
	) {}

	async execute(
		command: SendTargetedNotificationCommand,
	): Promise<BroadcastResult> {
		const { title, body, userIds, action } = command;
		const metadata = deriveBroadcastMetadata(action);

		const existingUserIds =
			await this.userDirectory.findExistingUserIds(userIds);

		if (existingUserIds.length === 0) {
			throw BusinessExceptions.adminNotificationTargetNotFound();
		}

		this.#logger.log(
			`Sending targeted notification to ${existingUserIds.length} users`,
		);

		const { count } = await this.notifier.sendBatch(
			existingUserIds.map((userId) => ({
				userId,
				type: "ADMIN_TARGETED" as const,
				title,
				body,
				action,
				metadata,
			})),
		);

		this.#logger.log(
			`Targeted notification completed: ${count} notifications sent`,
		);

		return buildBroadcastResult(existingUserIds.length, count);
	}
}
