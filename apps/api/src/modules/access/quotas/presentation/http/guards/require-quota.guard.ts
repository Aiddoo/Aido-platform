import { ErrorCode } from "@aido/api/errors";
import type { QuotaMeter } from "@aido/api/vocabulary";
import { type CanActivate, type ExecutionContext, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { z } from "zod";

import { ApplicationException } from "#api/shared/application/application.exception";

import { CheckQuotaRemainingUseCase } from "../../../application/use-cases/check-quota-remaining.use-case.js";

/** 라우트가 미리 확인할 계량기. @RequireQuota가 붙인다 */
export const REQUIRED_QUOTA_METER = Reflector.createDecorator<QuotaMeter>();

// 전역 JwtAuthGuard가 붙인 인증 사용자만 본다
const authenticatedRequestSchema = z.object({ user: z.object({ userId: z.string().min(1) }) });

@Injectable()
export class RequireQuotaGuard implements CanActivate {
  readonly #reflector: Reflector;
  readonly #checkQuotaRemaining: Pick<CheckQuotaRemainingUseCase, "execute">;

  constructor(reflector: Reflector, checkQuotaRemaining: CheckQuotaRemainingUseCase) {
    this.#reflector = reflector;
    this.#checkQuotaRemaining = checkQuotaRemaining;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const meter: QuotaMeter | undefined = this.#reflector.getAllAndOverride(REQUIRED_QUOTA_METER, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (meter == null) {
      return true;
    }
    const request = authenticatedRequestSchema.safeParse(context.switchToHttp().getRequest());
    if (!request.success) {
      // JwtAuthGuard가 먼저 실행되어야 한다
      throw new ApplicationException(ErrorCode.AUTH_0107);
    }
    await this.#checkQuotaRemaining.execute({ userId: request.data.user.userId, meter });
    return true;
  }
}
