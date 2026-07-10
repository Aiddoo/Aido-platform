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
import { BroadcastNotificationCommand } from "./broadcast-notification.command";

@CommandHandler(BroadcastNotificationCommand)
export class BroadcastNotificationHandler
	implements ICommandHandler<BroadcastNotificationCommand, BroadcastResult>
{
	readonly #logger = new Logger(BroadcastNotificationHandler.name);

	constructor(
		@Inject(ADMIN_USER_DIRECTORY)
		private readonly userDirectory: AdminUserDirectoryPort,
		@Inject(ADMIN_BROADCAST_NOTIFIER)
		private readonly notifier: AdminBroadcastNotifierPort,
	) {}

	async execute(
		command: BroadcastNotificationCommand,
	): Promise<BroadcastResult> {
		const { title, body, targetFilter, action } = command;
		const metadata = deriveBroadcastMetadata(action);

		let totalTargets = 0;
		let successCount = 0;

		// 대상 사용자를 배치로 스트리밍하며 배치마다 발송 (메모리 절약)
		for await (const userIds of this.userDirectory.streamTargetUserIds(
			targetFilter,
		)) {
			totalTargets += userIds.length;

			const { count } = await this.notifier.sendBatch(
				userIds.map((userId) => ({
					userId,
					type: "ADMIN_BROADCAST" as const,
					title,
					body,
					action,
					metadata,
				})),
			);
			successCount += count;
		}

		if (totalTargets === 0) {
			throw BusinessExceptions.adminNotificationTargetNotFound();
		}

		this.#logger.log(
			`Broadcast notification completed: ${successCount}/${totalTargets} sent, filter=${targetFilter}`,
		);

		return buildBroadcastResult(totalTargets, successCount);
	}
}
