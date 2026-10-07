import { ErrorCode } from "@aido/api/errors";

import { assertNotDeleted } from "#api/modules/identity/application/utils/auth/auth-validation.utils";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import type {
  AuthUserRepositoryPort,
  AuthAccountRepositoryPort,
} from "../../ports/auth/auth-persistence.port.js";
import type { VerificationService } from "../../services/auth/verification.service.js";

export interface RequestPasswordSetupCodeInput {
  readonly userId: string;
}

interface RequestPasswordSetupCodeDependencies {
  readonly userRepository: Pick<AuthUserRepositoryPort, "findById">;
  readonly accountRepository: Pick<AuthAccountRepositoryPort, "findByUserIdAndProvider">;
  readonly verificationService: Pick<VerificationService, "createAndSendPasswordSetup">;
}

export class RequestPasswordSetupCode {
  readonly #dependencies: RequestPasswordSetupCodeDependencies;

  constructor(dependencies: RequestPasswordSetupCodeDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: RequestPasswordSetupCodeInput): Promise<{ message: string }> {
    const { userId } = input;
    const user = await this.#dependencies.userRepository.findById(userId);
    if (user === null) {
      throw new ApplicationException(ErrorCode.USER_0601, { userId });
    }
    assertNotDeleted(user);

    const account = await this.#dependencies.accountRepository.findByUserIdAndProvider(
      userId,
      "CREDENTIAL",
    );
    if (account !== null) {
      throw new ApplicationException(ErrorCode.USER_0614, { userId });
    }

    await this.#dependencies.verificationService.createAndSendPasswordSetup(userId, user.email);

    return {
      message: "비밀번호 설정 코드가 이메일로 발송되었습니다.",
    };
  }
}
