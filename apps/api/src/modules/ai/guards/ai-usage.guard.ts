import type { CurrentUserPayload } from "@aido/validators";
import {
	type CanActivate,
	type ExecutionContext,
	Injectable,
} from "@nestjs/common";
import type { Request } from "express";
import { BusinessExceptions } from "../../../common/exception/services/business-exception.service";
import { AiService } from "../ai.service";

/**
 * AI 사용량 제한 Guard
 *
 * 사용자의 일일 AI 사용량을 체크하여 제한을 초과한 경우 요청을 차단합니다.
 * - 무료 사용자: 일일 5회 제한
 * - 프리미엄 사용자: 무제한 (향후 구현)
 */
@Injectable()
export class AiUsageGuard implements CanActivate {
	constructor(private readonly aiService: AiService) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest<Request>();
		const user = request.user as CurrentUserPayload | undefined;

		if (!user) {
			// JwtAuthGuard가 먼저 실행되어야 함
			throw BusinessExceptions.authenticationRequired();
		}

		const usage = await this.aiService.getUsage(user.userId);

		if (usage.used >= usage.limit) {
			throw BusinessExceptions.aiUsageLimitExceeded(usage.used, usage.limit);
		}

		return true;
	}
}
