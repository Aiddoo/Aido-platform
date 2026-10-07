import type { RegisterInput as RegisterBody } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";

import type {
  RegisterResult,
  RequestMetadata,
} from "#api/modules/identity/application/types/auth/index";
import {
  AUTH_DEFAULTS,
  SECURITY_EVENT,
} from "#api/modules/identity/domain/constants/auth/auth.constants";
import { Email } from "#api/modules/identity/domain/value-objects/auth/email.vo";
import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";
import type { UnitOfWorkPort } from "#api/shared/application/ports/index";
import { now } from "#api/shared/domain/date/utils/core";
import { toISOString } from "#api/shared/domain/date/utils/format";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import { IdentityLogEvent } from "../../observability/auth/identity-log.events.js";
import type {
  AuthRegistrationNotifierPort,
  AuthUserRegisteredNotification,
} from "../../ports/auth/auth-collaboration.port.js";
import type { AuthPasswordHasherPort } from "../../ports/auth/auth-crypto.port.js";
import {
  type AuthUserRepositoryPort,
  type AuthSecurityLogRepositoryPort,
  AuthPersistenceConflict,
} from "../../ports/auth/auth-persistence.port.js";
import type { VerificationService } from "../../services/auth/verification.service.js";
import type { ProvisionUser } from "./provision-user.use-case.js";

export type RegisterInput = Readonly<RegisterBody> & { readonly metadata?: RequestMetadata };

interface RegisterDependencies {
  readonly userRepository: Pick<AuthUserRepositoryPort, "findByEmail">;
  readonly passwordService: Pick<AuthPasswordHasherPort, "hash">;
  readonly provisionUserUseCase: Pick<ProvisionUser, "execute">;
  readonly verificationService: Pick<
    VerificationService,
    "createEmailVerification" | "sendVerificationEmail"
  >;
  readonly securityLogRepository: Pick<AuthSecurityLogRepositoryPort, "create">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly adminEventNotifier: Pick<AuthRegistrationNotifierPort, "notifyUserRegistered">;
  readonly logger: ApplicationLogger;
}

export class Register {
  readonly #dependencies: RegisterDependencies;

  constructor(dependencies: RegisterDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: RegisterInput): Promise<RegisterResult> {
    const metadata = input.metadata;
    const ip = metadata?.ip ?? AUTH_DEFAULTS.UNKNOWN_IP;
    const userAgent = metadata?.userAgent ?? AUTH_DEFAULTS.UNKNOWN_USER_AGENT;

    const { password, name, termsAgreed, privacyAgreed, marketingAgreed, marketingPushAgreed } =
      input;
    const email = Email.of(input.email).value;

    const existingUser = await this.#dependencies.userRepository.findByEmail(email);
    if (existingUser !== null) {
      throw new ApplicationException(ErrorCode.EMAIL_0501, { email });
    }

    const hashedPassword = await this.#dependencies.passwordService.hash(password);

    let result: {
      user: { id: string; email: string };
      verificationCode: string;
    };
    try {
      result = await this.#dependencies.unitOfWork.run(async () => {
        const currentTime = now();
        const newUser = await this.#dependencies.provisionUserUseCase.execute({
          email,
          status: "PENDING_VERIFY",
          account: { kind: "credential", hashedPassword },
          profile: { name },
          consent: {
            termsAgreedAt: termsAgreed ? currentTime : undefined,
            privacyAgreedAt: privacyAgreed ? currentTime : undefined,
            marketingAgreedAt: marketingAgreed ? currentTime : undefined,
            marketingPushAgreedAt: marketingPushAgreed ? currentTime : undefined,
          },
        });

        const verificationResult =
          await this.#dependencies.verificationService.createEmailVerification(newUser.id);

        await this.#dependencies.securityLogRepository.create({
          userId: newUser.id,
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
        throw new ApplicationException(ErrorCode.EMAIL_0501, { email });
      }
      throw error;
    }

    let emailSent = true;
    try {
      await this.#dependencies.verificationService.sendVerificationEmail(
        email,
        result.verificationCode,
      );
    } catch (error) {
      emailSent = false;
      this.#dependencies.logger.error({
        event: IdentityLogEvent.VERIFICATION_EMAIL_FAILED,
        userId: result.user.id,
        errorType: error instanceof Error ? error.name : "unknown",
      });
    }

    this.#dependencies.logger.log({
      event: IdentityLogEvent.USER_REGISTERED,
      userId: result.user.id,
    });

    this.#dependencies.adminEventNotifier.notifyUserRegistered({
      userId: result.user.id,
      email: result.user.email,
      provider: "credential",
      registeredAt: toISOString(now()),
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
