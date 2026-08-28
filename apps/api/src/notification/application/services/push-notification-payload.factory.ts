import { NOTIFICATION_ACTION_TYPE, type PushNotificationData } from "@aido/validators";
import { Inject, Injectable } from "@nestjs/common";

import { FEATURE_DISCOVERY_CAMPAIGN_KEY } from "../../domain/services/feature-marketing-capability";
import { toNotificationRouting } from "../../domain/services/notification-routing";
import { isMarketingNotification } from "../../domain/services/push-eligibility";
import {
	MARKETING_PUSH_OPT_OUT_TOKEN,
	type MarketingPushOptOutTokenPort,
} from "../ports/marketing-push-opt-out-token.port";
import type { CreateNotificationData } from "../ports/notification-data";
import type { PushPayload } from "../ports/push-provider.port";

interface CreatePushNotificationPayloadInput {
	readonly data: CreateNotificationData;
	readonly notificationId: number;
	readonly dispatchId: number;
}

export interface BatchPushNotificationPayload extends Omit<PushPayload, "token"> {
	readonly userId: string;
	readonly dispatchId: number;
	readonly requiresFeatureCapability: boolean;
}

/** 모바일 라우팅·컨텍스트·마케팅 메타데이터를 푸시 provider payload로 변환한다. */
@Injectable()
export class PushNotificationPayloadFactory {
	constructor(
		@Inject(MARKETING_PUSH_OPT_OUT_TOKEN)
		private readonly marketingOptOutTokens: MarketingPushOptOutTokenPort,
	) {}

	createSingle(input: CreatePushNotificationPayloadInput): Omit<PushPayload, "token"> {
		const { data, notificationId, dispatchId } = input;
		return {
			title: data.title,
			body: data.body,
			data: {
				...this.#createNotificationData(data, notificationId),
				dispatchId,
			},
			...((data.purpose === "ENGAGEMENT" || isMarketingNotification(data.type)) && {
				categoryId: "MARKETING",
			}),
		};
	}

	createBatch(input: CreatePushNotificationPayloadInput): BatchPushNotificationPayload {
		const { data, notificationId, dispatchId } = input;
		return {
			userId: data.userId,
			dispatchId,
			requiresFeatureCapability: data.campaignKey === FEATURE_DISCOVERY_CAMPAIGN_KEY,
			title: data.title,
			body: data.body,
			data: {
				...this.#createNotificationData(data, notificationId),
				dispatchId,
			},
			// 기존 배치 provider 계약은 categoryId를 전달하지 않는다. 단건과의 차이는
			// 후속 제품 변경에서 별도로 다루고 이번 구조 분리에서는 유지한다.
		};
	}

	#createNotificationData(
		data: CreateNotificationData,
		notificationId: number,
	): PushNotificationData {
		const action = data.action ?? {
			type: NOTIFICATION_ACTION_TYPE.DEEP_LINK,
			url: undefined,
		};
		const context: PushNotificationData["context"] = {};
		if (data.todoId) context.todoId = data.todoId;
		if (data.friendId) context.friendId = data.friendId;
		if (data.nudgeId) context.nudgeId = data.nudgeId;
		if (data.cheerId) context.cheerId = data.cheerId;
		const routing = toNotificationRouting(data.metadata);

		return {
			notificationId,
			type: data.type,
			action: {
				type: action.type,
				...(action.url && { url: action.url }),
			},
			...(Object.keys(context).length > 0 && { context }),
			...(routing && { routing }),
			...(data.campaignKey && { campaignKey: data.campaignKey }),
			...(data.variantId && { variantId: data.variantId }),
			...(data.purpose && { purpose: data.purpose }),
			...((data.purpose === "ENGAGEMENT" || isMarketingNotification(data.type)) && {
				marketingOptOutToken: this.marketingOptOutTokens.issue(data.userId),
			}),
		};
	}
}
