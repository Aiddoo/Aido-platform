import type { CurrentUserPayload } from "@aido/validators";
import {
	type CanActivate,
	type ExecutionContext,
	Injectable,
} from "@nestjs/common";
import type { Request } from "express";
import { BusinessExceptions } from "../../../common/exception/services/business-exception.service";
import type { UsageInfo } from "../ai.service";
import { AiService } from "../ai.service";

/** AI 사용량 정보가 첨부된 Request 타입 */
export interface AiUsageRequest extends Request {
	aiUsage?: UsageInfo;
}

/**
 * AI 사용량 제한 Guard
 *
 * 사용자의 일일 AI 사용량을 체크하여 제한을 초과한 경우 요청을 차단합니다.
 * - 무료 사용자: 일일 5회 제한
 * - 프리미엄 사용자: 무제한 (향후 구현)
 *
 * Guard에서 조회한 usage 정보를 request에 첨부하여 Service에서 재사용합니다.
 */
@Injectable()
export class AiUsageGuard implements CanActivate {
	constructor(private readonly aiService: AiService) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest<AiUsageRequest>();
		const user = request.user as CurrentUserPayload | undefined;

		if (!user) {
			// JwtAuthGuard가 먼저 실행되어야 함
			throw BusinessExceptions.authenticationRequired();
		}

		const usage = await this.aiService.getUsage(user.userId);

		if (usage.used >= usage.limit) {
			throw BusinessExceptions.aiUsageLimitExceeded(usage.used, usage.limit);
		}

		// Request에 usage 정보 첨부 (Service에서 재사용)
		request.aiUsage = usage;

		return true;
	}
}
