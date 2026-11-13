import { TERMS_VERSION, SECURITY_EVENT } from "@aido/api/vocabulary";

import { AuthPersistenceConflict } from "#api/modules/identity/auth/application/auth.errors";
import type {
  RegisterResult,
  RequestMetadata,
} from "#api/modules/identity/auth/application/read-models/auth-result.read-model";
import { AUTH_DEFAULTS } from "#api/modules/identity/auth/domain/auth.constants";
import { Email } from "#api/modules/identity/auth/domain/email.vo";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import { toIsoString } from "#api/shared/domain/time/instant";

import { emailAlreadyRegistered } from "../auth.errors.js";
import { AuthLogEvent } from "../auth.log-events.js";
import type {
  AuthRegistrationNotifierPort,
  AuthUserRegisteredNotification,
} from "../ports/auth-collaboration.port.js";
import type { AuthPasswordHasherPort } from "../ports/auth-crypto.port.js";
import { type AuthSecurityLogRepositoryPort } from "../ports/auth-security-log.repository.port.js";
import { type AuthUserRepositoryPort } from "../ports/auth-user.repository.port.js";
import type { IssueVerificationCodeUseCase } from "./issue-verification-code.use-case.js";
import type { ProvisionUserUseCase } from "./provision-user.use-case.js";
import type { SendVerificationCodeUseCase } from "./send-verification-code.use-case.js";

export interface RegisterCommand {
  readonly email: string;
  readonly password: string;
  readonly name?: string;
  readonly termsAgreed: true;
  readonly privacyAgreed: true;
  readonly marketingAgreed?: boolean;
  readonly marketingPushAgreed?: boolean;
  readonly metadata?: RequestMetadata;
}

interface RegisterDependencies {
  readonly userRepository: Pick<AuthUserRepositoryPort, "findByEmail">;
  readonly passwordService: Pick<AuthPasswordHasherPort, "hash">;
  readonly provisionUserUseCase: Pick<ProvisionUserUseCase, "execute">;
  readonly issueVerificationCode: Pick<IssueVerificationCodeUseCase, "execute">;
  readonly sendVerificationCode: Pick<SendVerificationCodeUseCase, "execute">;
  readonly securityLogRepository: Pick<AuthSecurityLogRepositoryPort, "create">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly adminEventNotifier: Pick<AuthRegistrationNotifierPort, "notifyUserRegistered">;
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
    const ip = metadata?.ip ?? AUTH_DEFAULTS.UNKNOWN_IP;
    const userAgent = metadata?.userAgent ?? AUTH_DEFAULTS.UNKNOWN_USER_AGENT;

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
      if (error instanceof AuthPersistenceConflict && error.kind === "EMAIL_ALREADY_EXISTS") {
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
      });
    } catch (error) {
      this.#dependencies.logger.error({
        event: AuthLogEvent.VERIFICATION_EMAIL_FAILED,
        userId: result.user.id,
        errorType: error instanceof Error ? error.name : "unknown",
      });
    }

    this.#dependencies.logger.log({
      event: AuthLogEvent.USER_REGISTERED,
      userId: result.user.id,
    });

    this.#dependencies.adminEventNotifier.notifyUserRegistered({
      userId: result.user.id,
      email: result.user.email,
      provider: "credential",
      registeredAt: toIsoString(this.#dependencies.clock.now()),
      name,
      ...metadata?.device,
    } satisfies AuthUserRegisteredNotification);

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
