import { timingSafeEqual } from "node:crypto";
import {
	CanActivate,
	ExecutionContext,
	Injectable,
	Logger,
} from "@nestjs/common";
import type { Request } from "express";

import { TypedConfigService } from "@/common/config/services/config.service";
import { BusinessExceptions } from "@/common/exception/services/business-exception.service";

/**
 * RevenueCat Webhook 서명 검증 가드
 *
 * RevenueCat는 HMAC이 아닌 단순 Authorization 헤더 비교 방식.
 * Dashboard에서 설정한 authorization_header 값이 그대로 전송됨.
 *
 * - webhook secret 미설정 시 개발 환경으로 간주하여 통과
 * - timing-safe comparison으로 타이밍 공격 방지
 */
@Injectable()
export class WebhookSignatureGuard implements CanActivate {
	readonly #logger = new Logger(WebhookSignatureGuard.name);

	constructor(private readonly config: TypedConfigService) {}

	canActivate(context: ExecutionContext): boolean {
		const request = context.switchToHttp().getRequest<Request>();
		const webhookSecret = this.config.revenuecat.webhookSecret;

		// webhook secret이 미설정이면 개발 환경으로 간주
		if (!webhookSecret) {
			this.#logger.warn(
				"REVENUECAT_WEBHOOK_SECRET not configured, skipping signature verification",
			);
			return true;
		}

		const authHeader = request.headers.authorization;
		if (!authHeader) {
			this.#logger.warn("Missing Authorization header");
			throw BusinessExceptions.webhookSignatureInvalid();
		}

		const expected = `Bearer ${webhookSecret}`;

		// timing-safe comparison (타이밍 공격 방지)
		const authBuffer = Buffer.from(authHeader);
		const expectedBuffer = Buffer.from(expected);

		if (
			authBuffer.length !== expectedBuffer.length ||
			!timingSafeEqual(authBuffer, expectedBuffer)
		) {
			this.#logger.warn("Webhook signature verification failed");
			throw BusinessExceptions.webhookSignatureInvalid();
		}

		return true;
	}
}
