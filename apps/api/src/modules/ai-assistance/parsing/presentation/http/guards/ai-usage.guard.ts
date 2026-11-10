import type { CurrentUserPayload } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";
import { type CanActivate, type ExecutionContext, Injectable } from "@nestjs/common";
import type { Request } from "express";

import { ApplicationException } from "#api/shared/application/application.exception";

import { GetAiUsage } from "../../../application/use-cases/get-ai-usage.use-case.js";

/** 인증 페이로드가 첨부된 Request 타입 (캐스트 없이 user 접근). */
interface AuthenticatedRequest extends Request {
  user?: CurrentUserPayload;
}

/**
 * AI 사용량 제한 Guard
 *
 * 사용자의 월간 AI 사용량을 체크하여 제한을 초과한 경우 요청을 차단합니다. 한도는 PLAN_CATALOG.AI_PARSE의
 * 집행 한도(프리미엄은 공정 사용 상한)다.
 *
 * 실제 원자적 차감은 파싱 핸들러의 원장 예약이 담당하며, 이 가드는 이미 한도에
 * 도달한 요청을 조기에 429로 차단하는 선검사입니다.
 */
@Injectable()
export class AiUsageGuard implements CanActivate {
  readonly #getAiUsageUseCase: GetAiUsage;

  constructor(getAiUsageUseCase: GetAiUsage) {
    this.#getAiUsageUseCase = getAiUsageUseCase;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;

    if (user == null) {
      // JwtAuthGuard가 먼저 실행되어야 함
      throw new ApplicationException(ErrorCode.AUTH_0107);
    }

    const featureQuota = await this.#getAiUsageUseCase.execute({ userId: user.userId });

    if (featureQuota.remaining === 0) {
      throw new ApplicationException(ErrorCode.AI_1303, { charged: false, featureQuota });
    }

    return true;
  }
}
