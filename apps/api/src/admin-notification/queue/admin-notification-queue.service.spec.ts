/**
 * AdminNotificationQueueService 모듈 단위 테스트
 *
 * @description
 * AdminNotificationQueueService 모듈의 DI 구성을 테스트합니다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test admin-notification-queue.service
 * ```
 */
import { getQueueToken } from "@nestjs/bullmq";
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { flushPromises } from "@test/mocks";
import type { Queue } from "bullmq";
import type { SubscriptionEventPayload } from "@/subscription/events/subscription.events";
import type { UserRegisteredEventPayload } from "../events/admin-notification.events";
import {
	ADMIN_NOTIFICATION_QUEUE,
	AdminNotificationJobName,
} from "./admin-notification-queue.constants";
import { AdminNotificationQueueService } from "./admin-notification-queue.service";

describe("AdminNotificationQueueService — 관리자 알림 서비스", () => {
	let service: AdminNotificationQueueService;
	let queue: Mocked<Queue>;

	beforeEach(async () => {
		const mockQueue = {
			add: jest.fn().mockResolvedValue(undefined),
		};

		const { unit, unitRef } = await TestBed.solitary(
			AdminNotificationQueueService,
		)
			.mock(getQueueToken(ADMIN_NOTIFICATION_QUEUE))
			.impl(() => mockQueue)
			.compile();

		service = unit;
		queue = unitRef.get(getQueueToken(ADMIN_NOTIFICATION_QUEUE));
	});

	describe("enqueueUserRegistered", () => {
		it("잡을 큐에 등록한다", async () => {
			// Given
			const payload: UserRegisteredEventPayload = {
				userId: "user-1",
				email: "test@example.com",
				provider: "apple",
				registeredAt: "2026-03-07T12:00:00.000Z",
			};

			// When
			service.enqueueUserRegistered(payload);
			await flushPromises();

			// Then
			expect(queue.add).toHaveBeenCalledWith(
				AdminNotificationJobName.SEND,
				expect.objectContaining({ channel: "admin" }),
				expect.any(Object),
			);
		});

		it("큐 등록 실패 시 에러를 throw하지 않는다 (fire-and-forget)", async () => {
			// Given
			queue.add.mockRejectedValue(new Error("Redis connection error"));
			const payload: UserRegisteredEventPayload = {
				userId: "user-1",
				email: "test@example.com",
				provider: "apple",
				registeredAt: "2026-03-07T12:00:00.000Z",
			};

			// When & Then — 에러 전파 없음
			service.enqueueUserRegistered(payload);
			await expect(flushPromises()).resolves.not.toThrow();
		});
	});

	describe("enqueueSubscriptionEvent", () => {
		it("잡을 큐에 등록한다", async () => {
			// Given
			const payload: SubscriptionEventPayload = {
				userId: "user-1",
				email: "test@example.com",
				eventType: "INITIAL_PURCHASE",
				productId: "aido_premium_monthly",
				store: "APP_STORE",
			};

			// When
			service.enqueueSubscriptionEvent(payload);
			await flushPromises();

			// Then
			expect(queue.add).toHaveBeenCalledWith(
				AdminNotificationJobName.SEND,
				expect.objectContaining({ channel: "payment" }),
				expect.any(Object),
			);
		});

		it("큐 등록 실패 시 에러를 throw하지 않는다 (fire-and-forget)", async () => {
			// Given
			queue.add.mockRejectedValue(new Error("Redis connection error"));
			const payload: SubscriptionEventPayload = {
				userId: "user-1",
				email: "test@example.com",
				eventType: "INITIAL_PURCHASE",
				productId: "aido_premium_monthly",
			};

			// When & Then — 에러 전파 없음
			service.enqueueSubscriptionEvent(payload);
			await expect(flushPromises()).resolves.not.toThrow();
		});

		it("구매 통화 기준으로 금액을 표시한다 (KRW ₩3,900)", async () => {
			// Given
			const payload: SubscriptionEventPayload = {
				userId: "user-1",
				email: "test@example.com",
				eventType: "INITIAL_PURCHASE",
				productId: "aido_premium_monthly",
				priceUsd: 2.99,
				priceInPurchasedCurrency: 3900,
				purchasedCurrency: "KRW",
			};

			// When
			service.enqueueSubscriptionEvent(payload);
			await flushPromises();

			// Then
			expect(queue.add).toHaveBeenCalledWith(
				AdminNotificationJobName.SEND,
				expect.objectContaining({
					channel: "payment",
					notification: expect.objectContaining({
						fields: expect.arrayContaining([
							expect.objectContaining({
								name: "금액",
								value: "₩3,900",
							}),
						]),
					}),
				}),
				expect.any(Object),
			);
		});

		it("구매 통화 금액이 없으면 USD fallback으로 금액을 표시한다", async () => {
			// Given
			const payload: SubscriptionEventPayload = {
				userId: "user-1",
				email: "test@example.com",
				eventType: "INITIAL_PURCHASE",
				productId: "aido_premium_monthly",
				priceUsd: 2.99,
			};

			// When
			service.enqueueSubscriptionEvent(payload);
			await flushPromises();

			// Then — Intl.NumberFormat 로케일에 따라 "$2.99" 또는 "US$2.99"
			expect(queue.add).toHaveBeenCalledWith(
				AdminNotificationJobName.SEND,
				expect.objectContaining({
					channel: "payment",
					notification: expect.objectContaining({
						fields: expect.arrayContaining([
							expect.objectContaining({
								name: "금액",
								value: expect.stringContaining("2.99"),
							}),
						]),
					}),
				}),
				expect.any(Object),
			);
		});

		it("이름이 있으면 body에 이름을 표시한다", async () => {
			// Given
			const payload: SubscriptionEventPayload = {
				userId: "user-1",
				email: "test@example.com",
				name: "매튜",
				eventType: "INITIAL_PURCHASE",
				productId: "aido_premium_monthly",
			};

			// When
			service.enqueueSubscriptionEvent(payload);
			await flushPromises();

			// Then
			expect(queue.add).toHaveBeenCalledWith(
				AdminNotificationJobName.SEND,
				expect.objectContaining({
					channel: "payment",
					notification: expect.objectContaining({
						body: expect.stringContaining("매튜"),
						fields: expect.arrayContaining([
							expect.objectContaining({
								name: "이름",
								value: "매튜",
							}),
						]),
					}),
				}),
				expect.any(Object),
			);
		});
	});
});
