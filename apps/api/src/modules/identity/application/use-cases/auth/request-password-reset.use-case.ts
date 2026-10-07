import type { RequestMetadata } from "#api/modules/identity/application/types/auth/index";
import {
  AUTH_DEFAULTS,
  SECURITY_EVENT,
} from "#api/modules/identity/domain/constants/auth/auth.constants";
import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";

import { IdentityLogEvent } from "../../observability/auth/identity-log.events.js";
import type {
  AuthUserRepositoryPort,
  AuthSecurityLogRepositoryPort,
} from "../../ports/auth/auth-persistence.port.js";
import type { VerificationService } from "../../services/auth/verification.service.js";

export interface RequestPasswordResetInput {
  readonly email: string;
  readonly metadata?: RequestMetadata;
}

interface RequestPasswordResetDependencies {
  readonly userRepository: Pick<AuthUserRepositoryPort, "findByEmail">;
  readonly verificationService: Pick<VerificationService, "createAndSendPasswordReset">;
  readonly securityLogRepository: Pick<AuthSecurityLogRepositoryPort, "create">;
  readonly logger: ApplicationLogger;
}

export class RequestPasswordReset {
  readonly #dependencies: RequestPasswordResetDependencies;

  constructor(dependencies: RequestPasswordResetDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: RequestPasswordResetInput): Promise<{ message: string }> {
    const { email, metadata } = input;
    const ip = metadata?.ip ?? AUTH_DEFAULTS.UNKNOWN_IP;
    const userAgent = metadata?.userAgent ?? AUTH_DEFAULTS.UNKNOWN_USER_AGENT;

    const user = await this.#dependencies.userRepository.findByEmail(email);

    if (user !== null && user.deletedAt === null) {
      await this.#dependencies.verificationService.createAndSendPasswordReset(user.id, email);

      await this.#dependencies.securityLogRepository.create({
        userId: user.id,
        event: SECURITY_EVENT.PASSWORD_RESET_REQUESTED,
        ipAddress: ip,
        userAgent,
        metadata: { email },
      });

      this.#dependencies.logger.debug({
        event: IdentityLogEvent.PASSWORD_RESET_REQUESTED,
        userId: user.id,
      });
    } else {
      this.#dependencies.logger.debug({ event: IdentityLogEvent.PASSWORD_RESET_REQUEST_SKIPPED });
    }

    return {
      message: "등록된 이메일인 경우 비밀번호 재설정 코드가 발송됩니다.",
    };
  }
}
