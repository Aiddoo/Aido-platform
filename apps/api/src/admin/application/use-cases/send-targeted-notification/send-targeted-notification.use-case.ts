import { ErrorCode } from "@aido/errors";
import type { NotificationAction } from "@aido/validators";
import { Inject, Injectable, Logger } from "@nestjs/common";
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

export interface SendTargetedNotificationInput {
	title: string;
	body: string;
	userIds: string[];
	action: NotificationAction | undefined;
}

/**
 * 특정 사용자 알림 발송 use-case.
 *
 * 존재하는 사용자만 필터링해 발송한다. 유효 대상이 없으면 ADMIN_1402.
 */
@Injectable()
export class SendTargetedNotificationUseCase {
	readonly #logger = new Logger(SendTargetedNotificationUseCase.name);

	constructor(
		@Inject(ADMIN_USER_DIRECTORY)
		private readonly userDirectory: AdminUserDirectoryPort,
		@Inject(ADMIN_BROADCAST_NOTIFIER)
		private readonly notifier: AdminBroadcastNotifierPort,
	) {}

	async execute(
		input: SendTargetedNotificationInput,
	): Promise<BroadcastResult> {
		// 타겟 발송은 필터가 없으므로 캠페인의 대상 필터는 사용하지 않는다(ALL 자리표시).
		// 제목/본문 불변식 검증과 메시지 조립만 캠페인에 위임한다.
		const campaign = BroadcastCampaign.create({
			title: input.title,
			body: input.body,
			targetFilter: "ALL",
			action: input.action,
		});

		const existingUserIds = await this.userDirectory.findExistingUserIds(
			input.userIds,
		);

		if (existingUserIds.length === 0) {
			throw new ApplicationException(ErrorCode.ADMIN_1402, {
				requested: input.userIds.length,
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
