/**
 * SubscriptionController 컨트롤러 단위 테스트
 *
 * 컨트롤러는 thin delegation만 담당한다 — 원시 본문(request.body)을 Facade로 넘기고
 * 결과를 반환하며, 예외(Lock 경합 1605 등)는 GlobalExceptionFilter로 전파한다.
 * 검증·Sentry·Discord 오케스트레이션은 use-case/adapter가 소유한다(각 spec에서 검증).
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test subscription.controller
 * ```
 */
import { ErrorCode } from "@aido/errors";
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { SubscriptionEventBuilder } from "@test/builders";
import type { Request } from "express";

import { ApplicationException } from "@/shared/domain/exceptions/application.exception";

import { SubscriptionFacade } from "../application/facades/subscription.facade";
import { SubscriptionController } from "./subscription.controller";

describe("SubscriptionController — 구독 컨트롤러 (thin delegation)", () => {
	let controller: SubscriptionController;
	let mockFacade: Mocked<SubscriptionFacade>;

	beforeEach(async () => {
		const { unit, unitRef } = await TestBed.solitary(
			SubscriptionController,
		).compile();

		controller = unit;
		mockFacade = unitRef.get(SubscriptionFacade);
	});

	describe("handleRevenueCatWebhook", () => {
		const validPayload = SubscriptionEventBuilder.initialPurchase()
			.withAppUserId("user-123")
			.withProductId("premium_monthly")
			.withPrice(4900, "KRW")
			.build();

		it("원시 request.body를 Facade로 위임하고 결과를 반환한다", async () => {
			// Given
			const request = { body: validPayload } as unknown as Request;
			mockFacade.handleWebhookEvent.mockResolvedValue({ received: true });

			// When
			const result = await controller.handleRevenueCatWebhook(request);

			// Then — 파싱 없이 원시 본문을 그대로 전달 (검증은 use-case 소유)
			expect(mockFacade.handleWebhookEvent).toHaveBeenCalledWith(validPayload);
			expect(result).toEqual({ received: true });
		});

		it("Lock 경합(SUBSCRIPTION_1605)은 잡지 않고 그대로 전파한다 (필터가 429 처리)", async () => {
			// Given
			const request = { body: validPayload } as unknown as Request;
			const lockError = new ApplicationException(ErrorCode.SUBSCRIPTION_1605, {
				appUserId: "user-123",
			});
			mockFacade.handleWebhookEvent.mockRejectedValue(lockError);

			// When & Then — try/catch 없이 GlobalExceptionFilter로 전파
			await expect(controller.handleRevenueCatWebhook(request)).rejects.toBe(
				lockError,
			);
		});
	});
});
