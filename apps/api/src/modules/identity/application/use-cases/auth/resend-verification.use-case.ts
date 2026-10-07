import { ErrorCode } from "@aido/api/errors";

import { assertStatusAllowsLogin } from "#api/modules/identity/domain/services/auth/account-status-policy";
import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import type { UnitOfWorkPort } from "#api/shared/application/ports/index";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import { IdentityLogEvent } from "../../observability/auth/identity-log.events.js";
import type { AuthUserRepositoryPort } from "../../ports/auth/auth-persistence.port.js";
import type { VerificationService } from "../../services/auth/verification.service.js";

export interface ResendVerificationInput {
  readonly email: string;
}

interface ResendVerificationDependencies {
  readonly userRepository: Pick<AuthUserRepositoryPort, "findByEmail">;
  readonly verificationService: Pick<
    VerificationService,
    "createEmailVerification" | "sendVerificationEmail"
  >;
  readonly unitOfWork: UnitOfWorkPort;
  readonly logger: ApplicationLogger;
}

export class ResendVerification {
  readonly #dependencies: ResendVerificationDependencies;

  constructor(dependencies: ResendVerificationDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: ResendVerificationInput): Promise<{ message: string }> {
    const { email } = input;
    const user = await this.#dependencies.userRepository.findByEmail(email);
    if (user === null) {
      return {
        message: "인증 코드가 발송되었습니다. 이메일을 확인해주세요.",
      };
    }

    if (user.status !== "PENDING_VERIFY") {
      if (user.emailVerifiedAt !== null) {
        throw new ApplicationException(ErrorCode.USER_0604, {
          email,
          message: "이미 인증이 완료된 계정입니다.",
        });
      }
      assertStatusAllowsLogin(user.status, email);
    }

    const verificationResult = await this.#dependencies.unitOfWork.run(() =>
      this.#dependencies.verificationService.createEmailVerification(user.id),
    );

    try {
      await this.#dependencies.verificationService.sendVerificationEmail(
        email,
        verificationResult.code,
      );
    } catch (error) {
      this.#dependencies.logger.error({
        event: IdentityLogEvent.VERIFICATION_EMAIL_FAILED,
        userId: user.id,
        errorType: error instanceof Error ? error.name : "unknown",
      });
    }

    this.#dependencies.logger.log({ event: IdentityLogEvent.VERIFICATION_RESENT, userId: user.id });

    return {
      message: "인증 코드가 발송되었습니다. 이메일을 확인해주세요.",
    };
  }
}
