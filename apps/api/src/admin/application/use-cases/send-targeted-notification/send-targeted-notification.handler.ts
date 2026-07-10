import { ErrorCode } from "@aido/errors";
import { Inject, Logger } from "@nestjs/common";
import { CommandHandler, type ICommandHandler } from "@nestjs/cqrs";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";
import {
	type BroadcastResult,
	buildBroadcastResult,
} from "../../../domain/broadcast-result";
import { BroadcastCampaign } from "../../../domain/entities/broadcast-campaign";
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
		// 타겟 발송은 필터가 없으므로 캠페인의 대상 필터는 사용하지 않는다(ALL 자리표시).
		// 제목/본문 불변식 검증과 메시지 조립만 캠페인에 위임한다.
		const campaign = BroadcastCampaign.create({
			title: command.title,
			body: command.body,
			targetFilter: "ALL",
			action: command.action,
		});

		const existingUserIds = await this.userDirectory.findExistingUserIds(
			command.userIds,
		);

		if (existingUserIds.length === 0) {
			throw new ApplicationException(ErrorCode.ADMIN_1402, {
				requested: command.userIds.length,
			});
		}

		this.#logger.log(
			`Sending targeted notification to ${existingUserIds.length} users`,
		);

		const { count } = await this.notifier.sendBatch(
			campaign.toMessages(existingUserIds, "ADMIN_TARGETED"),
		);

		this.#logger.log(
			`Targeted notification completed: ${count} notifications sent`,
		);

		return buildBroadcastResult(existingUserIds.length, count);
	}
}
