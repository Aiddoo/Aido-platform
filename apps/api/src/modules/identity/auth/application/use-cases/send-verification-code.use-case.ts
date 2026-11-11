import { VERIFICATION_CODE } from "@aido/api/vocabulary";
import { match } from "ts-pattern";

import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";

import type { VerificationType } from "../../domain/auth.constants.js";
import { AuthLogEvent } from "../auth.log-events.js";
import type { AuthEmailSenderPort } from "../ports/auth-collaboration.port.js";

export interface SendVerificationCodeCommand {
  readonly userId: string;
  readonly email: string;
  readonly code: string;
  readonly type: VerificationType;
}

interface SendVerificationCodeDependencies {
  readonly emailSender: AuthEmailSenderPort;
  readonly logger: ApplicationLoggerPort;
}

/** 발송 큐에 담았으면 true. 담지 못해도 예외를 던지지 않고 호출자가 다시 보내게 안내한다 */
export class SendVerificationCodeUseCase {
  readonly #dependencies: SendVerificationCodeDependencies;

  constructor(dependencies: SendVerificationCodeDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: SendVerificationCodeCommand): Promise<boolean> {
    const { emailSender, logger } = this.#dependencies;
    const message = { code: command.code, expiryMinutes: VERIFICATION_CODE.EXPIRY_MINUTES };
    const dispatch = await match(command.type)
      .with("EMAIL_VERIFY", () => emailSender.sendVerificationCode(command.email, message))
      .with("PASSWORD_RESET", () => emailSender.sendPasswordResetCode(command.email, message))
      .with("PASSWORD_SETUP", () => emailSender.sendPasswordSetupCode(command.email, message))
      .exhaustive();

    if (dispatch.status === "rejected") {
      logger.error({
        event: AuthLogEvent.VERIFICATION_EMAIL_FAILED,
        verificationType: command.type,
        userId: command.userId,
        reason: dispatch.reason,
      });
    }
    return dispatch.status === "queued";
  }
}
