import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { createMarketingPushOptOutTokenMock } from "@test/mocks/ports/notification.mock";

import {
	MARKETING_PUSH_OPT_OUT_TOKEN,
	type MarketingPushOptOutTokenPort,
} from "../ports/marketing-push-opt-out-token.port";
import { PushNotificationPayloadFactory } from "./push-notification-payload.factory";

describe("PushNotificationPayloadFactory", () => {
	let factory: PushNotificationPayloadFactory;
	let optOutTokens: Mocked<MarketingPushOptOutTokenPort>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(PushNotificationPayloadFactory)
			.mock<MarketingPushOptOutTokenPort>(MARKETING_PUSH_OPT_OUT_TOKEN)
			.impl(() => createMarketingPushOptOutTokenMock())
			.compile();
		factory = unit;
		optOutTokens = unitRef.get(MARKETING_PUSH_OPT_OUT_TOKEN);
		optOutTokens.issue.mockReturnValue("signed-opt-out-token");
	});

	it("단건 payload는 기본 액션, context, 댓글 routing과 분석 식별자를 조립한다", () => {
		const commentId = "cmt92zn3n000b7voxx9quc2th";
		const payload = factory.createSingle({
			data: {
				userId: "user-1",
				type: "TODO_SHARED",
				title: "새 댓글",
				body: "본문",
				todoId: 42,
				friendId: "friend-1",
				metadata: {
					commentId,
					threadRootId: commentId,
					activityKind: "COMMENT",
				},
				campaignKey: "transactional.v1",
				variantId: "comment.created.ko.v1",
			},
			notificationId: 101,
			dispatchId: 202,
		});

		expect(payload).toEqual({
			title: "새 댓글",
			body: "본문",
			data: {
				notificationId: 101,
				type: "TODO_SHARED",
				action: { type: "DEEP_LINK" },
				context: { todoId: 42, friendId: "friend-1" },
				routing: {
					commentId,
					threadRootId: commentId,
					activityKind: "COMMENT",
				},
				campaignKey: "transactional.v1",
				variantId: "comment.created.ko.v1",
				dispatchId: 202,
			},
		});
		expect(optOutTokens.issue).not.toHaveBeenCalled();
	});

	it("마케팅 단건은 opt-out token과 interactive category를 포함한다", () => {
		const payload = factory.createSingle({
			data: {
				userId: "user-1",
				type: "LUNCH_NUDGE",
				title: "점심",
				body: "본문",
				purpose: "ENGAGEMENT",
			},
			notificationId: 1,
			dispatchId: 2,
		});

		expect(payload.categoryId).toBe("MARKETING");
		expect(payload.data).toMatchObject({
			purpose: "ENGAGEMENT",
			marketingOptOutToken: "signed-opt-out-token",
		});
		expect(optOutTokens.issue).toHaveBeenCalledWith("user-1");
	});

	it("배치는 기존 provider 계약대로 categoryId를 생략하면서 동일한 마케팅 data를 유지한다", () => {
		const payload = factory.createBatch({
			data: {
				userId: "user-1",
				type: "SYSTEM_NOTICE",
				title: "새 기능",
				body: "본문",
				purpose: "ENGAGEMENT",
				campaignKey: "feature-discovery-2026-08",
			},
			notificationId: 10,
			dispatchId: 20,
		});

		expect(payload).toMatchObject({
			userId: "user-1",
			dispatchId: 20,
			requiresFeatureCapability: true,
			title: "새 기능",
			body: "본문",
			data: {
				notificationId: 10,
				dispatchId: 20,
				marketingOptOutToken: "signed-opt-out-token",
			},
		});
		expect(payload).not.toHaveProperty("categoryId");
	});

	it("명시 action URL은 타입과 함께 보존한다", () => {
		const payload = factory.createSingle({
			data: {
				userId: "user-1",
				type: "SYSTEM_NOTICE",
				title: "공지",
				body: "본문",
				action: { type: "BROWSER", url: "https://aido.kr/notice" },
			},
			notificationId: 1,
			dispatchId: 2,
		});

		expect(payload.data).toMatchObject({
			action: { type: "BROWSER", url: "https://aido.kr/notice" },
		});
	});
});
