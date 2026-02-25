import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";

import { NotificationService } from "@/modules/notification/notification.service";

import type { SubscriptionEventPayload } from "../events/subscription.events";
import { SubscriptionBillingIssueListener } from "./subscription-billing-issue.listener";

describe("SubscriptionBillingIssueListener", () => {
	let listener: SubscriptionBillingIssueListener;
	let notificationService: Mocked<NotificationService>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(
			SubscriptionBillingIssueListener,
		).compile();

		listener = unit;
		notificationService = unitRef.get(
			NotificationService,
		) as unknown as Mocked<NotificationService>;
	});

	const payload: SubscriptionEventPayload = {
		userId: "user-123",
		email: "test@example.com",
		eventType: "BILLING_ISSUE",
		productId: "premium_monthly",
		store: "APP_STORE",
		transactionId: "txn-123",
	};

	it("BILLING_ISSUE 이벤트 수신 시 SYSTEM_NOTICE 알림을 createAndSend로 생성한다", async () => {
		// Given
		notificationService.createAndSend.mockResolvedValue({} as never);

		// When
		await listener.handleBillingIssue(payload);

		// Then
		expect(notificationService.createAndSend).toHaveBeenCalledWith(
			expect.objectContaining({
				userId: "user-123",
				type: "SYSTEM_NOTICE",
				title: "결제 문제가 발생했어요",
				body: "결제 수단을 확인해주세요. 구독이 중단될 수 있습니다.",
			}),
		);
	});

	it("알림 생성 실패 시 에러를 잡아 로깅한다 (에러 전파 없음)", async () => {
		// Given
		notificationService.createAndSend.mockRejectedValue(new Error("DB error"));

		// When / Then — 에러를 throw하지 않음
		await expect(listener.handleBillingIssue(payload)).resolves.not.toThrow();
	});

	it("createAndSend를 정확히 한 번 호출한다", async () => {
		// Given
		notificationService.createAndSend.mockResolvedValue({} as never);

		// When
		await listener.handleBillingIssue(payload);

		// Then
		expect(notificationService.createAndSend).toHaveBeenCalledTimes(1);
	});
});
