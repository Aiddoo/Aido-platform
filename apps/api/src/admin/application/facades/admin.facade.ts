import type {
	GrowthSummaryQuery,
	GrowthSummaryResponse,
	NotificationAction,
} from "@aido/validators";
import { Injectable } from "@nestjs/common";
import type { BroadcastTargetFilter } from "../../domain/broadcast-message";
import type { BroadcastResult } from "../../domain/broadcast-result";
import { GetGrowthSummaryQuery } from "../queries/get-growth-summary/get-growth-summary.query";
import { BroadcastNotificationUseCase } from "../use-cases/broadcast-notification/broadcast-notification.use-case";
import { SendTargetedNotificationUseCase } from "../use-cases/send-targeted-notification/send-targeted-notification.use-case";

/**
 * 관리자 애플리케이션 서비스(Facade) — 컨트롤러와 use-case 사이의 얇은 seam.
 */
@Injectable()
export class AdminFacade {
	constructor(
		private readonly broadcastNotificationUseCase: BroadcastNotificationUseCase,
		private readonly sendTargetedNotificationUseCase: SendTargetedNotificationUseCase,
		private readonly getGrowthSummaryQuery: GetGrowthSummaryQuery,
	) {}

	broadcastNotification(
		title: string,
		body: string,
		targetFilter: BroadcastTargetFilter,
		action: NotificationAction | undefined,
		force: boolean,
	): Promise<BroadcastResult> {
		return this.broadcastNotificationUseCase.execute({
			title,
			body,
			targetFilter,
			action,
			force,
		});
	}

	sendTargetedNotification(
		title: string,
		body: string,
		userIds: string[],
		action: NotificationAction | undefined,
		force: boolean,
	): Promise<BroadcastResult> {
		return this.sendTargetedNotificationUseCase.execute({
			title,
			body,
			userIds,
			action,
			force,
		});
	}

	getGrowthSummary(query: GrowthSummaryQuery): Promise<GrowthSummaryResponse> {
		return this.getGrowthSummaryQuery.execute(query);
	}
}
