/**
 * SubscriptionController 컨트롤러 단위 테스트
 *
 * @description
 * SubscriptionController의 엔드포인트 핸들러를 격리 테스트합니다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test subscription.controller
 * ```
 */
jest.mock("@sentry/nestjs", () => ({
	captureException: jest.fn(),
	withScope: jest.fn((callback) =>
		callback({
			setTag: jest.fn(),
			setExtra: jest.fn(),
		}),
	),
}));

import { ErrorCode } from "@aido/errors";
import * as Sentry from "@sentry/nestjs";
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { SubscriptionEventBuilder } from "@test/builders";
import type { Request } from "express";

import { PAYMENT_NOTIFIER } from "@/admin-notification/providers/admin-notifier.interface";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";

import { SubscriptionFacade } from "../application/facades/subscription.facade";
import { SubscriptionController } from "./subscription.controller";

describe("SubscriptionController — 구독 컨트롤러", () => {
	let controller: SubscriptionController;
	let mockFacade: Mocked<SubscriptionFacade>;
	let mockNotifier: { send: jest.Mock; name: string; isConfigured: jest.Mock };

	beforeEach(async () => {
		mockNotifier = {
			name: "fake",
			send: jest.fn().mockResolvedValue({ success: true }),
			isConfigured: jest.fn().mockReturnValue(true),
		};

		const { unit, unitRef } = await TestBed.solitary(SubscriptionController)
			.mock(PAYMENT_NOTIFIER)
			.impl(() => mockNotifier)
			.compile();

		controller = unit;
		mockFacade = unitRef.get(SubscriptionFacade);
	});

	describe("handleRevenueCatWebhook", () => {
		const validPayload = SubscriptionEventBuilder.initialPurchase()
			.withAppUserId("user-123")
			.withProductId("premium_monthly")
			.withPrice(4900, "KRW")
			.build();

		it("유효한 payload → 서비스 호출 + { received: true } 반환", async () => {
			// Given
			const request = { body: validPayload } as unknown as Request;
			mockFacade.handleWebhookEvent.mockResolvedValue(undefined);

			// When
			const result = await controller.handleRevenueCatWebhook(request);

			// Then
			expect(mockFacade.handleWebhookEvent).toHaveBeenCalledTimes(1);
			expect(result).toEqual({ received: true });
		});

		it("Zod 검증 실패 (invalid payload) → 서비스 미호출 + { received: true }", async () => {
			// Given
			const invalidBody = { invalid: "data" };
			const request = { body: invalidBody } as unknown as Request;

			// When
			const result = await controller.handleRevenueCatWebhook(request);

			// Then
			expect(mockFacade.handleWebhookEvent).not.toHaveBeenCalled();
			expect(result).toEqual({ received: true });
		});

		it("Lock 경합 (SUBSCRIPTION_1605) → 재던짐 (429 유도), Sentry 미캡처", async () => {
			// Given
			const request = { body: validPayload } as unknown as Request;
			const lockError = new ApplicationException(ErrorCode.SUBSCRIPTION_1605, {
				appUserId: "user-123",
			});
			mockFacade.handleWebhookEvent.mockRejectedValue(lockError);

			// When & Then — 그대로 재던져 GlobalExceptionFilter가 429 처리
			await expect(controller.handleRevenueCatWebhook(request)).rejects.toBe(
				lockError,
			);
			expect(Sentry.captureException).not.toHaveBeenCalled();
			expect(mockNotifier.send).not.toHaveBeenCalled();
		});

		it("서비스 에러 → Sentry 캡처 (결제 context 포함) + Discord 알림 + { received: true }", async () => {
			// Given
			const request = { body: validPayload } as unknown as Request;
			const error = new Error("Processing failed");
			mockFacade.handleWebhookEvent.mockRejectedValue(error);
			const mockScope = { setTag: jest.fn(), setExtra: jest.fn() };
			(Sentry.withScope as jest.Mock).mockImplementation((cb) => cb(mockScope));

			// When
			const result = await controller.handleRevenueCatWebhook(request);
			// fire-and-forget 완료 대기
			await new Promise((resolve) => setTimeout(resolve, 0));

			// Then — Sentry context 검증
			expect(Sentry.withScope).toHaveBeenCalledTimes(1);
			expect(mockScope.setTag).toHaveBeenCalledWith("domain", "payment");
			expect(mockScope.setTag).toHaveBeenCalledWith(
				"webhook.event_type",
				"INITIAL_PURCHASE",
			);
			expect(mockScope.setExtra).toHaveBeenCalledWith(
				"webhook.app_user_id",
				"user-123",
			);
			expect(Sentry.captureException).toHaveBeenCalledWith(error);

			// Then — Discord 알림 검증
			expect(mockNotifier.send).toHaveBeenCalledWith(
				expect.objectContaining({
					title: "Webhook 처리 에러",
					color: 0xff0000,
					fields: expect.arrayContaining([
						expect.objectContaining({
							name: "에러",
							value: "Processing failed",
						}),
						expect.objectContaining({
							name: "이벤트 타입",
							value: "INITIAL_PURCHASE",
						}),
					]),
				}),
			);
			expect(result).toEqual({ received: true });
		});

		it("서비스 정상 처리 후 { received: true } 반환 확인", async () => {
			// Given
			const request = { body: validPayload } as unknown as Request;
			mockFacade.handleWebhookEvent.mockResolvedValue(undefined);

			// When
			const result = await controller.handleRevenueCatWebhook(request);

			// Then
			expect(mockFacade.handleWebhookEvent).toHaveBeenCalledTimes(1);
			expect(result).toEqual({ received: true });
			expect(Sentry.captureException).not.toHaveBeenCalled();
		});

		it("request.body가 빈 객체 → 서비스 미호출", async () => {
			// Given
			const request = { body: {} } as unknown as Request;

			// When
			const result = await controller.handleRevenueCatWebhook(request);

			// Then
			expect(mockFacade.handleWebhookEvent).not.toHaveBeenCalled();
			expect(result).toEqual({ received: true });
		});

		it("알 수 없는 이벤트 타입도 Zod 검증을 통과하고 서비스가 호출된다", async () => {
			// Given — RevenueCat이 새로 추가한 이벤트 타입 시뮬레이션
			const unknownEventPayload = SubscriptionEventBuilder.customType(
				"FUTURE_NEW_EVENT",
			)
				.withAppUserId("user-123")
				.build();
			const request = { body: unknownEventPayload } as unknown as Request;
			mockFacade.handleWebhookEvent.mockResolvedValue(undefined);

			// When
			const result = await controller.handleRevenueCatWebhook(request);

			// Then
			expect(mockFacade.handleWebhookEvent).toHaveBeenCalledTimes(1);
			expect(result).toEqual({ received: true });
		});

		it("알 수 없는 스토어 값도 Zod 검증을 통과한다", async () => {
			// Given — RevenueCat이 새로 추가한 스토어 시뮬레이션
			const payload = SubscriptionEventBuilder.initialPurchase()
				.withAppUserId("user-123")
				.withStore("ROKU")
				.build();
			const request = { body: payload } as unknown as Request;
			mockFacade.handleWebhookEvent.mockResolvedValue(undefined);

			// When
			const result = await controller.handleRevenueCatWebhook(request);

			// Then
			expect(mockFacade.handleWebhookEvent).toHaveBeenCalledTimes(1);
			expect(result).toEqual({ received: true });
		});

		it("서비스 호출 시 Zod 파싱된 데이터가 전달된다", async () => {
			// Given
			const request = { body: validPayload } as unknown as Request;
			mockFacade.handleWebhookEvent.mockResolvedValue(undefined);

			// When
			await controller.handleRevenueCatWebhook(request);

			// Then
			expect(mockFacade.handleWebhookEvent).toHaveBeenCalledWith(
				expect.objectContaining({
					event: expect.objectContaining({
						type: "INITIAL_PURCHASE",
						app_user_id: "user-123",
						product_id: "premium_monthly",
					}),
				}),
			);
		});

		it("Discord 알림 실패해도 webhook 응답에 영향 없다", async () => {
			// Given
			const request = { body: validPayload } as unknown as Request;
			mockFacade.handleWebhookEvent.mockRejectedValue(
				new Error("Processing failed"),
			);
			mockNotifier.send.mockRejectedValue(new Error("Discord down"));

			// When
			const result = await controller.handleRevenueCatWebhook(request);

			// Then
			expect(result).toEqual({ received: true });
		});
	});
});
