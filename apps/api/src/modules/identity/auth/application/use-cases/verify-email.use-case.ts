import { ErrorCode } from "@aido/api/errors";
import { SECURITY_EVENT } from "@aido/api/vocabulary";

import { accountDeleted } from "#api/modules/identity/auth/application/auth.errors";
import type {
  RequestMetadata,
  VerifyEmailResult,
} from "#api/modules/identity/auth/application/read-models/auth-result.read-model";
import { AUTH_DEFAULTS } from "#api/modules/identity/auth/domain/auth.constants";
import { assertStatusAllowsLogin } from "#api/modules/identity/users/domain/account-status.domain-service";
import { ApplicationException } from "#api/shared/application/application.exception";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

import { AuthLogEvent } from "../auth.log-events.js";
import type { AuthSecurityLogRepositoryPort } from "../ports/auth-security-log.repository.port.js";
import type { AuthUserRepositoryPort } from "../ports/auth-user.repository.port.js";
import type { RetentionEnrollerPort } from "../ports/retention-enroller.port.js";
import type { ConsumeVerificationCodeUseCase } from "./consume-verification-code.use-case.js";
import type { CreateSessionUseCase } from "./create-session.use-case.js";

export interface VerifyEmailCommand {
  readonly email: string;
  readonly code: string;
  readonly metadata?: RequestMetadata;
}

interface VerifyEmailDependencies {
  readonly userRepository: Pick<
    AuthUserRepositoryPort,
    "findByEmail" | "markEmailVerified" | "findByIdWithProfile"
  >;
  readonly consumeVerificationCode: Pick<ConsumeVerificationCodeUseCase, "execute">;
  readonly retentionEnroller: Pick<RetentionEnrollerPort, "activateNewUser">;
  readonly sessionService: Pick<CreateSessionUseCase, "execute">;
  readonly securityLogRepository: Pick<AuthSecurityLogRepositoryPort, "create">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly clock: ClockPort;
  readonly logger: ApplicationLoggerPort;
}

export class VerifyEmailUseCase {
  readonly #dependencies: VerifyEmailDependencies;

  constructor(dependencies: VerifyEmailDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: VerifyEmailCommand): Promise<VerifyEmailResult> {
    const metadata = input.metadata;
    const { email, code } = input;
    const ip = metadata?.ip ?? AUTH_DEFAULTS.UNKNOWN_IP;
    const userAgent = metadata?.userAgent ?? AUTH_DEFAULTS.UNKNOWN_USER_AGENT;

    const user = await this.#dependencies.userRepository.findByEmail(email);
    if (user == null) {
      throw new ApplicationException(ErrorCode.EMAIL_0502, { email });
    }

    if (user.isDeleted) {
      throw accountDeleted(user.id.value);
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

    const result = await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.consumeVerificationCode.execute({
        userId: user.id.value,
        code,
        type: "EMAIL_VERIFY",
      });

      await this.#dependencies.userRepository.markEmailVerified(
        user.id,
        this.#dependencies.clock.now(),
      );

      await this.#dependencies.retentionEnroller.activateNewUser(user.id);

      const { tokens } = await this.#dependencies.sessionService.execute({
        userId: user.id.value,
        email,
        role: user.role,
        deviceFingerprint: userAgent,
        userAgent,
        ipAddress: ip,
      });

      await this.#dependencies.securityLogRepository.create({
        userId: user.id,
        event: SECURITY_EVENT.EMAIL_VERIFIED,
        ipAddress: ip,
        userAgent,
      });

      const userWithProfile = await this.#dependencies.userRepository.findByIdWithProfile(user.id);

      return {
        tokens,
        name: userWithProfile?.profile?.name ?? null,
        profileImage: userWithProfile?.profile?.profileImage ?? null,
      };
    });

    this.#dependencies.logger.log({ event: AuthLogEvent.EMAIL_VERIFIED, userId: user.id.value });

    return {
      userId: user.id.value,
      userTag: user.userTag,
      tokens: result.tokens,
      name: result.name,
      profileImage: result.profileImage,
    };
  }
}
