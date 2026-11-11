import { ErrorCode } from "@aido/api/errors";

import { assertStatusAllowsLogin } from "#api/modules/identity/users/domain/account-status.domain-service";
import { ApplicationException } from "#api/shared/application/application.exception";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

import { AuthLogEvent } from "../auth.log-events.js";
import type { AuthUserRepositoryPort } from "../ports/auth-user.repository.port.js";
import type { IssueVerificationCodeUseCase } from "./issue-verification-code.use-case.js";
import type { SendVerificationCodeUseCase } from "./send-verification-code.use-case.js";

export interface ResendVerificationCommand {
  readonly email: string;
}

interface ResendVerificationDependencies {
  readonly userRepository: Pick<AuthUserRepositoryPort, "findByEmail">;
  readonly issueVerificationCode: Pick<IssueVerificationCodeUseCase, "execute">;
  readonly sendVerificationCode: Pick<SendVerificationCodeUseCase, "execute">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly logger: ApplicationLoggerPort;
}

export class ResendVerificationUseCase {
  readonly #dependencies: ResendVerificationDependencies;

  constructor(dependencies: ResendVerificationDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: ResendVerificationCommand): Promise<{ message: string }> {
    const { email } = input;
    const user = await this.#dependencies.userRepository.findByEmail(email);
    if (user == null) {
      return {
        message: "인증 코드가 발송되었습니다. 이메일을 확인해주세요.",
      };
    }

    if (user.status !== "PENDING_VERIFY") {
      if (user.emailVerifiedAt != null) {
        throw new ApplicationException(ErrorCode.USER_0604, {
          email,
          message: "이미 인증이 완료된 계정입니다.",
        });
      }
      assertStatusAllowsLogin(user.status, email);
    }

    const verificationResult = await this.#dependencies.unitOfWork.run(() =>
      this.#dependencies.issueVerificationCode.execute({
        userId: user.id.value,
        type: "EMAIL_VERIFY",
      }),
    );

    try {
      await this.#dependencies.sendVerificationCode.execute({
        userId: user.id.value,
        email,
        code: verificationResult.code,
        type: "EMAIL_VERIFY",
      });
    } catch (error) {
      this.#dependencies.logger.error({
        event: AuthLogEvent.VERIFICATION_EMAIL_FAILED,
        userId: user.id.value,
        errorType: error instanceof Error ? error.name : "unknown",
      });
    }

    this.#dependencies.logger.log({
      event: AuthLogEvent.VERIFICATION_RESENT,
      userId: user.id.value,
    });

    return {
      message: "인증 코드가 발송되었습니다. 이메일을 확인해주세요.",
    };
  }
}
