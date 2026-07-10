/**
 * WebhookSignatureGuard 가드 단위 테스트
 *
 * @description
 * WebhookSignatureGuard의 인가 로직을 격리 테스트합니다.
 *
 * 실행 명령:
 * ```bash
 * pnpm --filter @aido/api test webhook-signature.guard
 * ```
 */
import type { ExecutionContext } from "@nestjs/common";
import type { Mocked } from "@suites/doubles.jest";
import { TestBed } from "@suites/unit";
import { BusinessException } from "@/shared/application/exceptions/business-exception.service";
import { TypedConfigService } from "@/shared/infrastructure/config/services/config.service";

import { WebhookSignatureGuard } from "./webhook-signature.guard";

describe("WebhookSignatureGuard — 가드", () => {
	let guard: WebhookSignatureGuard;
	let _mockConfig: Mocked<TypedConfigService>;

	const createMockContext = (authorization?: string): ExecutionContext => {
		const mockRequest = {
			headers: {
				...(authorization !== undefined && { authorization }),
			},
		};
		return {
			switchToHttp: () => ({
				getRequest: () => mockRequest,
			}),
		} as unknown as ExecutionContext;
	};

	describe("webhook secret이 설정된 경우", () => {
		beforeEach(async () => {
			const { unit, unitRef } = await TestBed.solitary(WebhookSignatureGuard)
				.mock(TypedConfigService)
				.impl(
					() =>
						({
							revenuecat: { webhookSecret: "test-secret" },
						}) as unknown as TypedConfigService,
				)
				.compile();

			guard = unit;
			_mockConfig = unitRef.get(TypedConfigService);
		});

		it("올바른 Authorization 헤더 → 통과 (true)", () => {
			// Given
			const context = createMockContext("Bearer test-secret");

			// When
			const result = guard.canActivate(context);

			// Then
			expect(result).toBe(true);
		});

		it("Authorization 헤더 없음 → BusinessException", () => {
			// Given
			const context = createMockContext();

			// When & Then
			expect(() => guard.canActivate(context)).toThrow(BusinessException);
		});

		it("잘못된 값 → BusinessException", () => {
			// Given
			const context = createMockContext("Bearer wrong-secret");

			// When & Then
			expect(() => guard.canActivate(context)).toThrow(BusinessException);
		});

		it("길이가 다른 토큰 → 거부", () => {
			// Given
			const context = createMockContext("Bearer short");

			// When & Then
			expect(() => guard.canActivate(context)).toThrow(BusinessException);
		});

		it("Bearer prefix 없는 raw 값 → 통과 (true)", () => {
			// Given
			const context = createMockContext("test-secret");

			// When
			const result = guard.canActivate(context);

			// Then
			expect(result).toBe(true);
		});
	});

	describe("webhook secret이 미설정된 경우 (개발 환경)", () => {
		beforeEach(async () => {
			const { unit } = await TestBed.solitary(WebhookSignatureGuard)
				.mock(TypedConfigService)
				.impl(
					() =>
						({
							revenuecat: { webhookSecret: "" },
							isProduction: false,
						}) as unknown as TypedConfigService,
				)
				.compile();

			guard = unit;
		});

		it("secret 미설정 → 통과 (true)", () => {
			// Given
			const context = createMockContext();

			// When
			const result = guard.canActivate(context);

			// Then
			expect(result).toBe(true);
		});
	});

	describe("webhook secret이 미설정된 경우 (프로덕션 환경)", () => {
		beforeEach(async () => {
			const { unit } = await TestBed.solitary(WebhookSignatureGuard)
				.mock(TypedConfigService)
				.impl(
					() =>
						({
							revenuecat: { webhookSecret: "" },
							isProduction: true,
						}) as unknown as TypedConfigService,
				)
				.compile();

			guard = unit;
		});

		it("프로덕션 + secret 미설정 → BusinessException", () => {
			// Given
			const context = createMockContext();

			// When & Then
			expect(() => guard.canActivate(context)).toThrow(BusinessException);
		});
	});
});
