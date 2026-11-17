import { TERMS_VERSION, SECURITY_EVENT, type SupportedLocale } from "@aido/api/vocabulary";

import { Email } from "#api/modules/identity/shared/domain/email.vo";
import { IdentityPersistenceConflict } from "#api/modules/identity/shared/domain/identity.errors";
import type { RequestMetadata } from "#api/modules/identity/shared/domain/request-metadata.constants";
import { REQUEST_ORIGIN_DEFAULTS } from "#api/modules/identity/shared/domain/request-metadata.constants";
import type { RegisterResult } from "#api/modules/identity/users/application/read-models/user-account.read-model";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { toIsoString } from "#api/shared/domain/time/instant";

import type { PasswordHasherPort } from "../../../linked-accounts/application/ports/password-hasher.port.js";
import type { IssueVerificationCodeUseCase } from "../../../verifications/application/use-cases/issue-verification-code.use-case.js";
import type { SendVerificationCodeUseCase } from "../../../verifications/application/use-cases/send-verification-code.use-case.js";
import { VerificationLogEvent } from "../../../verifications/application/verifications.log-events.js";
import { type SecurityLogRepositoryPort } from "../ports/security-log.repository.port.js";
import type {
  UserRegistrationNotifierPort,
  UserRegisteredNotification,
} from "../ports/user-registration-notifier.port.js";
import { type UserRepositoryPort } from "../ports/user.repository.port.js";
import { emailAlreadyRegistered } from "../users.errors.js";
import { UserLogEvent } from "../users.log-events.js";
import type { ProvisionUserUseCase } from "./provision-user.use-case.js";

export interface RegisterCommand {
  readonly email: string;
  readonly password: string;
  readonly name?: string;
  readonly termsAgreed: true;
  readonly privacyAgreed: true;
  readonly marketingAgreed?: boolean;
  readonly marketingPushAgreed?: boolean;
  readonly metadata?: RequestMetadata;
  /** 코드 메일을 쓸 언어. 요청 응답과 같은 언어다 */
  readonly emailLocale: SupportedLocale;
}

interface RegisterDependencies {
  readonly userRepository: Pick<UserRepositoryPort, "findByEmail">;
  readonly passwordService: Pick<PasswordHasherPort, "hash">;
  readonly provisionUserUseCase: Pick<ProvisionUserUseCase, "execute">;
  readonly issueVerificationCode: Pick<IssueVerificationCodeUseCase, "execute">;
  readonly sendVerificationCode: Pick<SendVerificationCodeUseCase, "execute">;
  readonly securityLogRepository: Pick<SecurityLogRepositoryPort, "create">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly adminEventNotifier: Pick<UserRegistrationNotifierPort, "notifyUserRegistered">;
  readonly clock: ClockPort;
  readonly logger: ApplicationLoggerPort;
}

export class RegisterUseCase {
  readonly #dependencies: RegisterDependencies;

  constructor(dependencies: RegisterDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: RegisterCommand): Promise<RegisterResult> {
    const metadata = input.metadata;
    const ip = metadata?.ip ?? REQUEST_ORIGIN_DEFAULTS.UNKNOWN_IP;
    const userAgent = metadata?.userAgent ?? REQUEST_ORIGIN_DEFAULTS.UNKNOWN_USER_AGENT;

    const { password, name, termsAgreed, privacyAgreed, marketingAgreed, marketingPushAgreed } =
      input;
    const email = Email.create(input.email).value;

    const existingUser = await this.#dependencies.userRepository.findByEmail(email);
    if (existingUser != null) {
      throw emailAlreadyRegistered(email);
    }

    const hashedPassword = await this.#dependencies.passwordService.hash(password);

    let result: {
      user: { id: string; email: string };
      verificationCode: string;
    };
    try {
      result = await this.#dependencies.unitOfWork.run(async () => {
        const currentTime = this.#dependencies.clock.now();
        const newUser = await this.#dependencies.provisionUserUseCase.execute({
          email,
          status: "PENDING_VERIFY",
          account: { kind: "credential", hashedPassword },
          profile: { name },
          consent: {
            termsAgreedAt: termsAgreed ? currentTime : undefined,
            privacyAgreedAt: privacyAgreed ? currentTime : undefined,
            agreedTermsVersion: termsAgreed ? TERMS_VERSION.CURRENT : undefined,
            marketingAgreedAt: marketingAgreed ? currentTime : undefined,
            marketingPushAgreedAt: marketingPushAgreed ? currentTime : undefined,
          },
          locale: metadata?.locale,
        });

        const verificationResult = await this.#dependencies.issueVerificationCode.execute({
          userId: newUser.id,
          type: "EMAIL_VERIFY",
        });

        await this.#dependencies.securityLogRepository.create({
          userId: UserId.reconstitute(newUser.id),
          event: SECURITY_EVENT.REGISTRATION,
          ipAddress: ip,
          userAgent,
        });

        return {
          user: newUser,
          verificationCode: verificationResult.code,
        };
      });
    } catch (error) {
      if (error instanceof IdentityPersistenceConflict && error.kind === "EMAIL_ALREADY_EXISTS") {
        throw emailAlreadyRegistered(email);
      }
      throw error;
    }

    let emailSent = false;
    try {
      emailSent = await this.#dependencies.sendVerificationCode.execute({
        userId: result.user.id,
        email,
        code: result.verificationCode,
        type: "EMAIL_VERIFY",
        emailLocale: input.emailLocale,
      });
    } catch (error) {
      this.#dependencies.logger.error({
        event: VerificationLogEvent.VERIFICATION_EMAIL_FAILED,
        userId: result.user.id,
        errorType: error instanceof Error ? error.name : "unknown",
      });
    }

    this.#dependencies.logger.log({
      event: UserLogEvent.USER_REGISTERED,
      userId: result.user.id,
    });

    this.#dependencies.adminEventNotifier.notifyUserRegistered({
      userId: UserId.reconstitute(result.user.id),
      email: result.user.email,
      provider: "credential",
      registeredAt: toIsoString(this.#dependencies.clock.now()),
      name,
      ...metadata?.device,
    } satisfies UserRegisteredNotification);

    return {
      userId: result.user.id,
      email: result.user.email,
      emailSent,
      message: emailSent
        ? "회원가입이 완료되었습니다. 이메일로 발송된 인증 코드를 확인해주세요."
        : "회원가입이 완료되었습니다. 인증 이메일 발송에 실패했습니다. 잠시 후 이메일 재발송을 시도해주세요.",
    };
  }
}
