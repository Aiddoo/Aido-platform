import type { VerifyEmailInput as VerifyEmailBody } from "@aido/api";
import { ErrorCode } from "@aido/api/errors";

import { assertNotDeleted } from "#api/modules/identity/auth/application/auth.errors";
import type {
  RequestMetadata,
  VerifyEmailResult,
} from "#api/modules/identity/auth/application/read-models/auth-result.read-model";
import { assertStatusAllowsLogin } from "#api/modules/identity/auth/domain/account-status.domain-service";
import { AUTH_DEFAULTS, SECURITY_EVENT } from "#api/modules/identity/auth/domain/auth.constants";
import { ApplicationException } from "#api/shared/application/application.exception";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/index";

import { IdentityLogEvent } from "../auth.log-events.js";
import type {
  AuthUserRepositoryPort,
  AuthSecurityLogRepositoryPort,
} from "../ports/auth-persistence.port.js";
import type { RetentionEnrollerPort } from "../ports/retention-enroller.port.js";
import type { SessionService } from "./create-session.use-case.js";
import type { VerificationService } from "./issue-verification-code.use-case.js";

export type VerifyEmailInput = Readonly<VerifyEmailBody> & { readonly metadata?: RequestMetadata };

interface VerifyEmailDependencies {
  readonly userRepository: Pick<
    AuthUserRepositoryPort,
    "findByEmail" | "markEmailVerified" | "findByIdWithProfile"
  >;
  readonly verificationService: Pick<VerificationService, "verifyCode">;
  readonly retentionEnroller: Pick<RetentionEnrollerPort, "activateNewUser">;
  readonly sessionService: Pick<SessionService, "createSessionWithTokens">;
  readonly securityLogRepository: Pick<AuthSecurityLogRepositoryPort, "create">;
  readonly unitOfWork: UnitOfWorkPort;
  readonly logger: ApplicationLoggerPort;
}

export class VerifyEmail {
  readonly #dependencies: VerifyEmailDependencies;

  constructor(dependencies: VerifyEmailDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: VerifyEmailInput): Promise<VerifyEmailResult> {
    const metadata = input.metadata;
    const { email, code } = input;
    const ip = metadata?.ip ?? AUTH_DEFAULTS.UNKNOWN_IP;
    const userAgent = metadata?.userAgent ?? AUTH_DEFAULTS.UNKNOWN_USER_AGENT;

    const user = await this.#dependencies.userRepository.findByEmail(email);
    if (user == null) {
      throw new ApplicationException(ErrorCode.EMAIL_0502, { email });
    }

    assertNotDeleted(user);

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
      await this.#dependencies.verificationService.verifyCode(user.id, code, "EMAIL_VERIFY");

      await this.#dependencies.userRepository.markEmailVerified(user.id);

      await this.#dependencies.retentionEnroller.activateNewUser(user.id);

      const { tokens } = await this.#dependencies.sessionService.createSessionWithTokens({
        userId: user.id,
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

    this.#dependencies.logger.log({ event: IdentityLogEvent.EMAIL_VERIFIED, userId: user.id });

    return {
      userId: user.id,
      userTag: user.userTag,
      tokens: result.tokens,
      name: result.name,
      profileImage: result.profileImage,
    };
  }
}
