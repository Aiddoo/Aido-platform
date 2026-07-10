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
		// 도메인 불변식 검증(제목/본문 비어 있지 않음) 후 캠페인 생성
		const campaign = BroadcastCampaign.create({
			title: command.title,
			body: command.body,
			targetFilter: command.targetFilter,
			action: command.action,
		});

		let totalTargets = 0;
		let successCount = 0;

		// 대상 사용자를 배치로 스트리밍하며 배치마다 발송 (메모리 절약)
		for await (const userIds of this.userDirectory.streamTargetUserIds(
			campaign.targetFilter,
		)) {
			totalTargets += userIds.length;

			const { count } = await this.notifier.sendBatch(
				campaign.toMessages(userIds, "ADMIN_BROADCAST"),
			);
			successCount += count;
		}

		if (totalTargets === 0) {
			throw new ApplicationException(ErrorCode.ADMIN_1402, {
				targetFilter: command.targetFilter,
			});
		}

		this.#logger.log(
			`Broadcast notification completed: ${successCount}/${totalTargets} sent, filter=${command.targetFilter}`,
		);

		return buildBroadcastResult(totalTargets, successCount);
	}
}
