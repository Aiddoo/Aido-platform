import type { SupportedLocale } from "@aido/api/vocabulary";
import { Injectable } from "@nestjs/common";

import { SendCodeEmailUseCase } from "#api/modules/notification/email-messages/notification-email-messages.public";

import {
  type VerificationCodeEmailDispatch,
  VerificationCodeEmailSenderPort,
} from "../../application/ports/verification-code-email-sender.port.js";

type CodeTemplateData = Parameters<VerificationCodeEmailSenderPort["sendVerificationCode"]>[1];

// 인증 코드 메일을 notification 메일 발송 UseCase 하나로 보낸다
@Injectable()
export class VerificationCodeEmailSenderAdapter extends VerificationCodeEmailSenderPort {
  readonly #sendCodeEmail: Pick<SendCodeEmailUseCase, "execute">;

  constructor(sendCodeEmail: SendCodeEmailUseCase) {
    super();
    this.#sendCodeEmail = sendCodeEmail;
  }

  sendVerificationCode(
    to: string,
    templateData: CodeTemplateData,
    locale: SupportedLocale,
  ): Promise<VerificationCodeEmailDispatch> {
    return this.#sendCodeEmail.execute({ to, kind: "verification", templateData, locale });
  }

  sendPasswordResetCode(
    to: string,
    templateData: CodeTemplateData,
    locale: SupportedLocale,
  ): Promise<VerificationCodeEmailDispatch> {
    return this.#sendCodeEmail.execute({ to, kind: "password-reset", templateData, locale });
  }

  sendPasswordSetupCode(
    to: string,
    templateData: CodeTemplateData,
    locale: SupportedLocale,
  ): Promise<VerificationCodeEmailDispatch> {
    return this.#sendCodeEmail.execute({ to, kind: "password-setup", templateData, locale });
  }
}
