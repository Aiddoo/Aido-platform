import { ErrorCode } from "@aido/api/errors";

import { accountDeleted } from "#api/modules/identity/auth/application/auth.errors";
import { ApplicationException } from "#api/shared/application/application.exception";

import type {
  AuthUserRepositoryPort,
  AuthAccountRepositoryPort,
} from "../ports/auth-persistence.port.js";
import type { VerificationService } from "./issue-verification-code.use-case.js";

export interface RequestPasswordSetupCodeCommand {
  readonly userId: string;
}

interface RequestPasswordSetupCodeDependencies {
  readonly userRepository: Pick<AuthUserRepositoryPort, "findById">;
  readonly accountRepository: Pick<AuthAccountRepositoryPort, "findByUserIdAndProvider">;
  readonly verificationService: Pick<VerificationService, "createAndSendPasswordSetup">;
}

export class RequestPasswordSetupCodeUseCase {
  readonly #dependencies: RequestPasswordSetupCodeDependencies;

  constructor(dependencies: RequestPasswordSetupCodeDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: RequestPasswordSetupCodeCommand): Promise<{ message: string }> {
    const { userId } = input;
    const user = await this.#dependencies.userRepository.findById(userId);
    if (user == null) {
      throw new ApplicationException(ErrorCode.USER_0601, { userId });
    }
    if (user.isDeleted) {
      throw accountDeleted(user.id.value);
    }

    const account = await this.#dependencies.accountRepository.findByUserIdAndProvider(
      userId,
      "CREDENTIAL",
    );
    if (account != null) {
      throw new ApplicationException(ErrorCode.USER_0614, { userId });
    }

    await this.#dependencies.verificationService.createAndSendPasswordSetup(userId, user.email);

    return {
      message: "비밀번호 설정 코드가 이메일로 발송되었습니다.",
    };
  }
}
