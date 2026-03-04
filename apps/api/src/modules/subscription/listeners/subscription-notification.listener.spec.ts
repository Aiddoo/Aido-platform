import { getQueueToken } from "@nestjs/bullmq";
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import type { Queue } from "bullmq";

import { ADMIN_NOTIFICATION_QUEUE } from "@/modules/admin-notification/processors/admin-notification.processor";

import type { SubscriptionEventPayload } from "../events/subscription.events";
import { SubscriptionNotificationListener } from "./subscription-notification.listener";

describe("SubscriptionNotificationListener", () => {
	let listener: SubscriptionNotificationListener;
	let mockQueue: Mocked<Queue>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(
			SubscriptionNotificationListener,
		)
			.mock(getQueueToken(ADMIN_NOTIFICATION_QUEUE))
			.impl(() => ({
				add: jest.fn().mockResolvedValue(undefined),
			}))
			.compile();

		listener = unit;
		mockQueue = unitRef.get(getQueueToken(ADMIN_NOTIFICATION_QUEUE));
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	// =========================================================================
	// 기본 페이로드
	// =========================================================================

	const basePayload: SubscriptionEventPayload = {
		userId: "user-123",
		email: "test@example.com",
		eventType: "INITIAL_PURCHASE",
		productId: "premium_monthly",
		store: "APP_STORE",
		transactionId: "txn-123",
		purchasedAt: "2024-01-01T00:00:00.000Z",
		expiresAt: "2024-02-01T00:00:00.000Z",
		price: 4900,
		currency: "KRW",
	};

	/** queue.add 호출의 job data에서 notification 추출 */
	function getNotification() {
		return mockQueue.add.mock.calls[0]?.[1]?.notification;
	}

	/** notification의 특정 이름 필드 반환 */
	function getField(name: string) {
		return getNotification()?.fields?.find(
			(f: { name: string }) => f.name === name,
		);
	}

	// =========================================================================
	// 이벤트 타입별 제목/이모지
	// =========================================================================

	it("INITIAL_PURCHASE 이벤트 → 올바른 제목/이모지 전송", async () => {
		// Given
		const payload: SubscriptionEventPayload = { ...basePayload };

		// When
		await listener.handleSubscriptionEvent(payload);

		// Then
		expect(mockQueue.add).toHaveBeenCalledWith(
			"send-notification",
			expect.objectContaining({
				channel: "payment",
				notification: expect.objectContaining({
					title: "🎉 새로운 구독 구매",
					body: expect.stringContaining("INITIAL_PURCHASE"),
					color: 0x57f287,
				}),
			}),
			expect.any(Object),
		);
	});

	it("CANCELLATION 이벤트 → 올바른 제목/이모지 전송", async () => {
		// Given
		const payload: SubscriptionEventPayload = {
			...basePayload,
			eventType: "CANCELLATION",
			cancelReason: "UNSUBSCRIBE",
		};

		// When
		await listener.handleSubscriptionEvent(payload);

		// Then
		const notification = getNotification();
		expect(notification?.title).toBe("❌ 구독 취소");
		expect(notification?.color).toBe(0xe74c3c);
	});

	it("알 수 없는 이벤트 타입 → DEFAULT_META 사용", async () => {
		// Given
		const payload: SubscriptionEventPayload = {
			...basePayload,
			eventType: "UNKNOWN_EVENT_TYPE",
		};

		// When
		await listener.handleSubscriptionEvent(payload);

		// Then
		const notification = getNotification();
		expect(notification?.title).toBe("📋 구독 이벤트");
		expect(notification?.color).toBe(0x7289da);
	});

	// =========================================================================
	// 필드 구성 검증
	// =========================================================================

	it("필드에 이메일, 상품, 스토어, 기기, 금액, 만료일, 사용자 ID가 포함되어야 한다", async () => {
		// Given
		const payload: SubscriptionEventPayload = { ...basePayload };

		// When
		await listener.handleSubscriptionEvent(payload);

		// Then
		const notification = getNotification();
		expect(notification?.fields).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					name: "이메일",
					value: "test@example.com",
				}),
				expect.objectContaining({ name: "상품", value: "premium_monthly" }),
				expect.objectContaining({ name: "스토어", value: "Apple App Store" }),
				expect.objectContaining({ name: "기기" }),
				expect.objectContaining({ name: "금액" }),
				expect.objectContaining({ name: "만료일" }),
				expect.objectContaining({ name: "사용자 ID", value: "user-123" }),
			]),
		);
	});

	// =========================================================================
	// body 포맷
	// =========================================================================

	it("body에 사용자 이메일이 볼드로 포함되어야 한다", async () => {
		// Given
		const payload: SubscriptionEventPayload = { ...basePayload };

		// When
		await listener.handleSubscriptionEvent(payload);

		// Then
		expect(getNotification()?.body).toContain("**test@example.com**");
	});

	// =========================================================================
	// 채널
	// =========================================================================

	it("payment 채널로 등록되어야 한다", async () => {
		// When
		await listener.handleSubscriptionEvent(basePayload);

		// Then
		expect(mockQueue.add).toHaveBeenCalledWith(
			"send-notification",
			expect.objectContaining({ channel: "payment" }),
			expect.any(Object),
		);
	});

	// =========================================================================
	// 기기 정보
	// =========================================================================

	it("APP_STORE 이벤트에 기기 정보가 iOS로 표시되어야 한다", async () => {
		// Given
		const payload: SubscriptionEventPayload = {
			...basePayload,
			store: "APP_STORE",
		};

		// When
		await listener.handleSubscriptionEvent(payload);

		// Then
		expect(getField("기기")?.value).toContain("iOS");
	});

	it("PLAY_STORE 이벤트에 기기 정보가 Android로 표시되어야 한다", async () => {
		// Given
		const payload: SubscriptionEventPayload = {
			...basePayload,
			store: "PLAY_STORE",
		};

		// When
		await listener.handleSubscriptionEvent(payload);

		// Then
		expect(getField("기기")?.value).toContain("Android");
	});

	it("store가 없으면 기기 필드가 없어야 한다", async () => {
		// Given
		const payload: SubscriptionEventPayload = {
			...basePayload,
			store: undefined,
		};

		// When
		await listener.handleSubscriptionEvent(payload);

		// Then
		expect(getField("기기")).toBeUndefined();
	});

	// =========================================================================
	// 날짜 포맷 (Discord 타임스탬프)
	// =========================================================================

	it("만료일이 Discord timestamp 형식으로 포맷되어야 한다", async () => {
		// Given
		const payload: SubscriptionEventPayload = {
			...basePayload,
			expiresAt: "2026-02-26T00:33:00.000Z",
		};

		// When
		await listener.handleSubscriptionEvent(payload);

		// Then
		expect(getField("만료일")?.value).toMatch(/^<t:\d+:f>$/);
	});

	// =========================================================================
	// 금액 포맷
	// =========================================================================

	it("금액이 KRW 통화로 포맷되어야 한다", async () => {
		// Given
		const payload: SubscriptionEventPayload = {
			...basePayload,
			price: 4900,
			currency: "KRW",
		};

		// When
		await listener.handleSubscriptionEvent(payload);

		// Then
		expect(getField("금액")?.value).toMatch(/4,900|₩/);
	});

	// =========================================================================
	// 취소 사유
	// =========================================================================

	it("취소 사유가 포함되어야 한다", async () => {
		// Given
		const payload: SubscriptionEventPayload = {
			...basePayload,
			eventType: "CANCELLATION",
			cancelReason: "UNSUBSCRIBE",
		};

		// When
		await listener.handleSubscriptionEvent(payload);

		// Then
		const notification = getNotification();
		expect(notification?.fields).toEqual(
			expect.arrayContaining([
				expect.objectContaining({
					name: "취소 사유",
					value: "UNSUBSCRIBE",
				}),
			]),
		);
	});

	// =========================================================================
	// 에러 처리
	// =========================================================================

	it("큐 등록 실패해도 예외가 전파되지 않는다", async () => {
		// Given
		mockQueue.add.mockRejectedValue(new Error("Queue error"));

		// When & Then
		await expect(
			listener.handleSubscriptionEvent(basePayload),
		).resolves.not.toThrow();
	});
});
