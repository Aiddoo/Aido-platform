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
import { Test } from "@nestjs/testing";
import { createMockExecutionContext } from "@test/mocks";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";
import { TypedConfigService } from "@/shared/infrastructure/config/services/config.service";

import { WebhookSignatureGuard } from "./webhook-signature.guard";

/** 가드가 참조하는 config 필드만 담은 스텁 형태 */
interface GuardConfigStub {
	revenuecat: { webhookSecret: string };
	isProduction?: boolean;
}

/**
 * TypedConfigService 부분 스텁으로 가드 인스턴스를 생성한다.
 * (useValue는 any이므로 부분 객체를 캐스트 없이 주입할 수 있다)
 */
async function createGuard(
	config: GuardConfigStub,
): Promise<WebhookSignatureGuard> {
	const moduleRef = await Test.createTestingModule({
		providers: [
			WebhookSignatureGuard,
			{ provide: TypedConfigService, useValue: config },
		],
	}).compile();

	return moduleRef.get(WebhookSignatureGuard);
}

describe("WebhookSignatureGuard — 가드", () => {
	describe("webhook secret이 설정된 경우", () => {
		let guard: WebhookSignatureGuard;

		beforeEach(async () => {
			guard = await createGuard({
				revenuecat: { webhookSecret: "test-secret" },
			});
		});

		it("올바른 Authorization 헤더 → 통과 (true)", () => {
			const { context } = createMockExecutionContext({
				headers: { authorization: "Bearer test-secret" },
			});

			expect(guard.canActivate(context)).toBe(true);
		});

		it("Authorization 헤더 없음 → ApplicationException", () => {
			const { context } = createMockExecutionContext({ headers: {} });

			expect(() => guard.canActivate(context)).toThrow(ApplicationException);
		});

		it("잘못된 값 → ApplicationException", () => {
			const { context } = createMockExecutionContext({
				headers: { authorization: "Bearer wrong-secret" },
			});

			expect(() => guard.canActivate(context)).toThrow(ApplicationException);
		});

		it("길이가 다른 토큰 → 거부", () => {
			const { context } = createMockExecutionContext({
				headers: { authorization: "Bearer short" },
			});

			expect(() => guard.canActivate(context)).toThrow(ApplicationException);
		});

		it("Bearer prefix 없는 raw 값 → 통과 (true)", () => {
			const { context } = createMockExecutionContext({
				headers: { authorization: "test-secret" },
			});

			expect(guard.canActivate(context)).toBe(true);
		});
	});

	describe("webhook secret이 미설정된 경우 (개발 환경)", () => {
		it("secret 미설정 → 통과 (true)", async () => {
			const guard = await createGuard({
				revenuecat: { webhookSecret: "" },
				isProduction: false,
			});
			const { context } = createMockExecutionContext({ headers: {} });

			expect(guard.canActivate(context)).toBe(true);
		});
	});

	describe("webhook secret이 미설정된 경우 (프로덕션 환경)", () => {
		it("프로덕션 + secret 미설정 → ApplicationException", async () => {
			const guard = await createGuard({
				revenuecat: { webhookSecret: "" },
				isProduction: true,
			});
			const { context } = createMockExecutionContext({ headers: {} });

			expect(() => guard.canActivate(context)).toThrow(ApplicationException);
		});
	});
});
