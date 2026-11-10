import type { CurrentUserPayload } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";
import { type CanActivate, type ExecutionContext, Inject, Injectable } from "@nestjs/common";
import type { Request } from "express";

import { RequestClientReader } from "#api/platform/http/request-client/index";
import { ApplicationException } from "#api/shared/application/application.exception";

import {
  AI_DATA_SHARING_CONSENT_DECISION_READER,
  type AiDataSharingConsentDecisionReaderPort,
} from "../../../application/ports/parsing/ai-data-sharing-consent.reader.port.js";
import { canShareWithAi } from "../../../domain/policies/parsing/ai-data-sharing-consent.policy.js";

interface AuthenticatedRequest extends Request {
  user?: CurrentUserPayload;
}

/**
 * 1.13.0 이상 앱의 AI 요청은 AI 데이터 처리 동의가 있어야 통과한다.
 * 사용량 차감·공급자 호출보다 먼저 실행되도록 AI 사용량 guard 앞에 둔다.
 */
@Injectable()
export class AiDataSharingConsentGuard implements CanActivate {
  constructor(
    @Inject(AI_DATA_SHARING_CONSENT_DECISION_READER)
    private readonly consentReader: AiDataSharingConsentDecisionReaderPort,
    private readonly requestClientReader: RequestClientReader,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    if (user == null) {
      throw new ApplicationException(ErrorCode.AUTH_0107);
    }

    const { appVersion } = this.requestClientReader.current();
    const { decision } = await this.consentReader.findAiDataSharingConsent(user.userId);
    if (!canShareWithAi(decision, appVersion)) {
      throw new ApplicationException(ErrorCode.AI_1311, { decision });
    }
    return true;
  }
}
