import type { SupportedLocale } from "@aido/api/vocabulary";

import { assertStatusAllowsLogin } from "#api/modules/identity/users/domain/account-status.domain-service";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

import type { UserRepositoryPort } from "../../../users/application/ports/user.repository.port.js";
import { emailAlreadyVerified } from "../verifications.errors.js";
import { VerificationLogEvent } from "../verifications.log-events.js";
import type { CheckVerificationEmailCapUseCase } from "./check-verification-email-cap.use-case.js";
import type { IssueVerificationCodeUseCase } from "./issue-verification-code.use-case.js";
import type { RecordVerificationEmailSentUseCase } from "./record-verification-email-sent.use-case.js";
import type { SendVerificationCodeUseCase } from "./send-verification-code.use-case.js";

export interface ResendVerificationCommand {
  readonly email: string;
  /** 코드 메일을 쓸 언어. 요청 응답과 같은 언어다 */
  readonly emailLocale: SupportedLocale;
}

interface ResendVerificationDependencies {
  readonly userRepository: Pick<UserRepositoryPort, "findByEmail">;
  readonly checkVerificationEmailCap: Pick<CheckVerificationEmailCapUseCase, "execute">;
  readonly recordVerificationEmailSent: Pick<RecordVerificationEmailSentUseCase, "execute">;
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
    const { email, emailLocale } = input;
    // 상한은 계정을 찾기 전에 이메일마다 본다. 없는 이메일도 보냈다고 답하므로 똑같이 센다
    await this.#dependencies.checkVerificationEmailCap.execute({ email });
    const user = await this.#dependencies.userRepository.findByEmail(email);
    if (user == null) {
      await this.#dependencies.recordVerificationEmailSent.execute({ email });
      return {
        message: "인증 코드가 발송되었습니다. 이메일을 확인해주세요.",
      };
    }

    if (user.status !== "PENDING_VERIFY") {
      if (user.emailVerifiedAt != null) {
        throw emailAlreadyVerified(email);
      }
      assertStatusAllowsLogin(user.status, email);
    }

    const verificationResult = await this.#dependencies.unitOfWork.run(() =>
      this.#dependencies.issueVerificationCode.execute({
        userId: user.id.value,
        type: "EMAIL_VERIFY",
      }),
    );
    await this.#dependencies.recordVerificationEmailSent.execute({ email });

    try {
      await this.#dependencies.sendVerificationCode.execute({
        userId: user.id.value,
        email,
        code: verificationResult.code,
        type: "EMAIL_VERIFY",
        emailLocale,
      });
    } catch (error) {
      this.#dependencies.logger.error({
        event: VerificationLogEvent.VERIFICATION_EMAIL_FAILED,
        userId: user.id.value,
        errorType: error instanceof Error ? error.name : "unknown",
      });
    }

    this.#dependencies.logger.log({
      event: VerificationLogEvent.VERIFICATION_RESENT,
      userId: user.id.value,
    });

    return {
      message: "인증 코드가 발송되었습니다. 이메일을 확인해주세요.",
    };
  }
}
