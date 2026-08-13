import { ErrorCode } from "@aido/errors";
import type { CurrentUserPayload } from "@aido/validators";
import {
	type CanActivate,
	type ExecutionContext,
	Injectable,
} from "@nestjs/common";
import type { Request } from "express";
import { ApplicationException } from "@/shared/domain/exceptions/application.exception";
import { GetAiUsageUseCase } from "../../application/queries/get-ai-usage/get-ai-usage.use-case";

/** 인증 페이로드가 첨부된 Request 타입 (캐스트 없이 user 접근). */
interface AuthenticatedRequest extends Request {
	user?: CurrentUserPayload;
}

/**
 * AI 사용량 제한 Guard
 *
 * 사용자의 월간 AI 사용량을 체크하여 제한을 초과한 경우 요청을 차단합니다.
 * - 무료 사용자: 월 5회 제한 (KST 매월 1일 00:00 리셋)
 * - ADMIN/ACTIVE 구독자: 무제한
 *
 * 실제 원자적 차감은 파싱 핸들러의 사용량 미터가 담당하며, 이 가드는 이미 한도에
 * 도달한 요청을 조기에 429로 차단하는 선검사입니다.
 */
@Injectable()
export class AiUsageGuard implements CanActivate {
	constructor(private readonly getAiUsageUseCase: GetAiUsageUseCase) {}

	async canActivate(context: ExecutionContext): Promise<boolean> {
		const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
		const user = request.user;

		if (!user) {
			// JwtAuthGuard가 먼저 실행되어야 함
			throw new ApplicationException(ErrorCode.AUTH_0107);
		}

		const usage = await this.getAiUsageUseCase.execute({ userId: user.userId });

		if (usage.isExceeded()) {
			throw new ApplicationException(ErrorCode.AI_1303, {
				used: usage.used,
				limit: usage.limit,
			});
		}

		return true;
	}
}
