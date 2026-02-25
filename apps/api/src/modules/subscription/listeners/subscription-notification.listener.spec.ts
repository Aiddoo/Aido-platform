import { TestBed } from "@suites/unit";

import { PAYMENT_NOTIFIER } from "@/modules/admin-notification/providers/admin-notifier.interface";

import type { SubscriptionEventPayload } from "../events/subscription.events";
import { SubscriptionNotificationListener } from "./subscription-notification.listener";

describe("SubscriptionNotificationListener", () => {
	let listener: SubscriptionNotificationListener;
	let notifier: { send: jest.Mock; name: string; isConfigured: jest.Mock };

	beforeEach(async () => {
		const mockNotifier = {
			name: "fake",
			send: jest.fn().mockResolvedValue({ success: true }),
			isConfigured: jest.fn().mockReturnValue(true),
		};

		const { unit } = await TestBed.solitary(SubscriptionNotificationListener)
			.mock(PAYMENT_NOTIFIER)
			.impl(() => mockNotifier)
			.compile();

		listener = unit;
		notifier = mockNotifier;
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

	/** send 호출의 첫 번째 인자 반환 */
	function getSendArg() {
		return notifier.send.mock.calls[0]?.[0];
	}

	/** 특정 이름의 필드 반환 */
	function getField(name: string) {
		return getSendArg()?.fields?.find((f: { name: string }) => f.name === name);
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
		expect(notifier.send).toHaveBeenCalledWith(
			expect.objectContaining({
				title: "🎉 새로운 구독 구매",
				body: expect.stringContaining("INITIAL_PURCHASE"),
				color: 0x57f287,
			}),
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
		expect(notifier.send).toHaveBeenCalledWith(
			expect.objectContaining({
				title: "❌ 구독 취소",
				color: 0xe74c3c,
			}),
		);
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
		expect(notifier.send).toHaveBeenCalledWith(
			expect.objectContaining({
				title: "📋 구독 이벤트",
				color: 0x7289da,
			}),
		);
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
		expect(notifier.send).toHaveBeenCalledWith(
			expect.objectContaining({
				fields: expect.arrayContaining([
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
			}),
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
		expect(getSendArg().body).toContain("**test@example.com**");
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
		expect(notifier.send).toHaveBeenCalledWith(
			expect.objectContaining({
				fields: expect.arrayContaining([
					expect.objectContaining({
						name: "취소 사유",
						value: "UNSUBSCRIBE",
					}),
				]),
			}),
		);
	});

	// =========================================================================
	// 에러 처리
	// =========================================================================

	it("발송 실패해도 예외가 전파되지 않는다", async () => {
		// Given
		notifier.send.mockRejectedValue(new Error("Network error"));

		// When & Then
		await expect(
			listener.handleSubscriptionEvent(basePayload),
		).resolves.not.toThrow();
	});
});
