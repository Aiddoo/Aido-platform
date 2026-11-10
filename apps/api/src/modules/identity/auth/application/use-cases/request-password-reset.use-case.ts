import { SECURITY_EVENT } from "@aido/api/vocabulary";

import type { RequestMetadata } from "#api/modules/identity/auth/application/read-models/auth-result.read-model";
import { AUTH_DEFAULTS } from "#api/modules/identity/auth/domain/auth.constants";
import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";

import { AuthLogEvent } from "../auth.log-events.js";
import type {
  AuthUserRepositoryPort,
  AuthSecurityLogRepositoryPort,
} from "../ports/auth-persistence.port.js";
import type { VerificationService } from "./issue-verification-code.use-case.js";

export interface RequestPasswordResetCommand {
  readonly email: string;
  readonly metadata?: RequestMetadata;
}

interface RequestPasswordResetDependencies {
  readonly userRepository: Pick<AuthUserRepositoryPort, "findByEmail">;
  readonly verificationService: Pick<VerificationService, "createAndSendPasswordReset">;
  readonly securityLogRepository: Pick<AuthSecurityLogRepositoryPort, "create">;
  readonly logger: ApplicationLoggerPort;
}

export class RequestPasswordResetUseCase {
  readonly #dependencies: RequestPasswordResetDependencies;

  constructor(dependencies: RequestPasswordResetDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: RequestPasswordResetCommand): Promise<{ message: string }> {
    const { email, metadata } = input;
    const ip = metadata?.ip ?? AUTH_DEFAULTS.UNKNOWN_IP;
    const userAgent = metadata?.userAgent ?? AUTH_DEFAULTS.UNKNOWN_USER_AGENT;

    const user = await this.#dependencies.userRepository.findByEmail(email);

    if (user != null && user.deletedAt == null) {
      await this.#dependencies.verificationService.createAndSendPasswordReset(user.id.value, email);

      await this.#dependencies.securityLogRepository.create({
        userId: user.id.value,
        event: SECURITY_EVENT.PASSWORD_RESET_REQUESTED,
        ipAddress: ip,
        userAgent,
        metadata: { email },
      });

      this.#dependencies.logger.debug({
        event: AuthLogEvent.PASSWORD_RESET_REQUESTED,
        userId: user.id.value,
      });
    } else {
      this.#dependencies.logger.debug({ event: AuthLogEvent.PASSWORD_RESET_REQUEST_SKIPPED });
    }

    return {
      message: "등록된 이메일인 경우 비밀번호 재설정 코드가 발송됩니다.",
    };
  }
}
