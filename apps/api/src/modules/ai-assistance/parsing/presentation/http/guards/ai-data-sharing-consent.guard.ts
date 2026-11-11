import type { CurrentUserPayload } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";
import { type CanActivate, type ExecutionContext, Injectable } from "@nestjs/common";
import type { Request } from "express";

import { AiDataSharingConsentReaderPort } from "#api/modules/identity/identity-settings.public";
import { RequestClientReader } from "#api/platform/http/request-client/request-client.store";
import { ApplicationException } from "#api/shared/application/application.exception";
import { ClockPort } from "#api/shared/application/ports/clock.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { canShareWithAi } from "../../../../shared/domain/ai-data-sharing-consent.domain-service.js";

interface AuthenticatedRequest extends Request {
  user?: CurrentUserPayload;
}

/**
 * 1.13.0 이상 앱의 AI 요청은 AI 데이터 처리 동의가 있어야 통과한다.
 * 사용량 차감·공급자 호출보다 먼저 실행되도록 AI 사용량 guard 앞에 둔다.
 */
@Injectable()
export class AiDataSharingConsentGuard implements CanActivate {
  readonly #consentReader: Pick<AiDataSharingConsentReaderPort, "findAiDataSharingConsent">;
  readonly #requestClientReader: RequestClientReader;
  readonly #clock: ClockPort;

  constructor(
    consentReader: AiDataSharingConsentReaderPort,
    requestClientReader: RequestClientReader,
    clock: ClockPort,
  ) {
    this.#consentReader = consentReader;
    this.#requestClientReader = requestClientReader;
    this.#clock = clock;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = request.user;
    if (user == null) {
      throw new ApplicationException(ErrorCode.AUTH_0107);
    }

    const { appVersion } = this.#requestClientReader.current();
    const consent = await this.#consentReader.findAiDataSharingConsent(
      UserId.reconstitute(user.userId),
    );
    if (!canShareWithAi({ consent, appVersion, now: this.#clock.now() })) {
      throw new ApplicationException(ErrorCode.AI_1311, { decision: consent.status().decision });
    }
    return true;
  }
}
