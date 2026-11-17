import type { EmailVerificationReadModel } from "#api/modules/identity/sessions/application/read-models/login.read-model";
import type { RequestMetadata } from "#api/modules/identity/shared/domain/request-metadata.constants";
import { REQUEST_ORIGIN_DEFAULTS } from "#api/modules/identity/shared/domain/request-metadata.constants";
import { accountDeleted } from "#api/modules/identity/users/application/users.errors";
import { assertStatusAllowsLogin } from "#api/modules/identity/users/domain/account-status.domain-service";
import { SECURITY_EVENT } from "#api/modules/identity/users/domain/users.constants";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";

import type { RetentionEnrollerPort } from "../../../users/application/ports/retention-enroller.port.js";
import type { SecurityLogRepositoryPort } from "../../../users/application/ports/security-log.repository.port.js";
import type { UserRepositoryPort } from "../../../users/application/ports/user.repository.port.js";
import type { ConsumeVerificationCodeUseCase } from "../../../verifications/application/use-cases/consume-verification-code.use-case.js";
import {
  emailAlreadyVerified,
  emailNotRegistered,
} from "../../../verifications/application/verifications.errors.js";
import { SessionLogEvent } from "../sessions.log-events.js";
import type { CreateSessionUseCase } from "./create-session.use-case.js";

export interface VerifyEmailCommand {
  readonly email: string;
  readonly code: string;
  readonly metadata?: RequestMetadata;
}

interface VerifyEmailDependencies {
  readonly userRepository: Pick<UserRepositoryPort, "findByEmail" | "save" | "findByIdWithProfile">;
  readonly consumeVerificationCode: Pick<ConsumeVerificationCodeUseCase, "execute">;
  readonly retentionEnroller: Pick<RetentionEnrollerPort, "activateNewUser">;
  readonly sessionService: Pick<CreateSessionUseCase, "execute">;
  readonly securityLogRepository: Pick<SecurityLogRepositoryPort, "create">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly clock: ClockPort;
  readonly logger: ApplicationLoggerPort;
}

export class VerifyEmailUseCase {
  readonly #dependencies: VerifyEmailDependencies;

  constructor(dependencies: VerifyEmailDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: VerifyEmailCommand): Promise<EmailVerificationReadModel> {
    const metadata = input.metadata;
    const { email, code } = input;
    const ip = metadata?.ip ?? REQUEST_ORIGIN_DEFAULTS.UNKNOWN_IP;
    const userAgent = metadata?.userAgent ?? REQUEST_ORIGIN_DEFAULTS.UNKNOWN_USER_AGENT;

    const user = await this.#dependencies.userRepository.findByEmail(email);
    if (user == null) {
      throw emailNotRegistered(email);
    }

    if (user.isDeleted) {
      throw accountDeleted(user.id.value);
    }

    if (user.status !== "PENDING_VERIFY") {
      if (user.emailVerifiedAt != null) {
        throw emailAlreadyVerified(email);
      }
      assertStatusAllowsLogin(user.status, email);
    }

    const result = await this.#dependencies.unitOfWork.run(async () => {
      await this.#dependencies.consumeVerificationCode.execute({
        userId: user.id.value,
        code,
        type: "EMAIL_VERIFY",
      });

      if (user.markEmailVerified(this.#dependencies.clock.now())) {
        await this.#dependencies.userRepository.save(user);
      }

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

    this.#dependencies.logger.log({ event: SessionLogEvent.EMAIL_VERIFIED, userId: user.id.value });

    return {
      userId: user.id.value,
      userTag: user.userTag,
      tokens: result.tokens,
      name: result.name,
      profileImage: result.profileImage,
    };
  }
}
