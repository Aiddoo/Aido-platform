import { accountDeleted } from "#api/modules/identity/auth/application/auth.errors";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { passwordAlreadySet, userNotFound } from "../auth.errors.js";
import type { AuthAccountRepositoryPort } from "../ports/auth-account.repository.port.js";
import type { AuthUserRepositoryPort } from "../ports/auth-user.repository.port.js";
import type { IssueVerificationCodeUseCase } from "./issue-verification-code.use-case.js";
import type { SendVerificationCodeUseCase } from "./send-verification-code.use-case.js";

export interface RequestPasswordSetupCodeCommand {
  readonly userId: string;
}

interface RequestPasswordSetupCodeDependencies {
  readonly userRepository: Pick<AuthUserRepositoryPort, "findById">;
  readonly accountRepository: Pick<AuthAccountRepositoryPort, "findByUserIdAndProvider">;
  readonly issueVerificationCode: Pick<IssueVerificationCodeUseCase, "execute">;
  readonly sendVerificationCode: Pick<SendVerificationCodeUseCase, "execute">;
}

export class RequestPasswordSetupCodeUseCase {
  readonly #dependencies: RequestPasswordSetupCodeDependencies;

  constructor(dependencies: RequestPasswordSetupCodeDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: RequestPasswordSetupCodeCommand): Promise<{ message: string }> {
    const userId = UserId.reconstitute(input.userId);
    const user = await this.#dependencies.userRepository.findById(userId);
    if (user == null) {
      throw userNotFound(input.userId);
    }
    if (user.isDeleted) {
      throw accountDeleted(user.id.value);
    }

    const account = await this.#dependencies.accountRepository.findByUserIdAndProvider(
      userId,
      "CREDENTIAL",
    );
    if (account != null) {
      throw passwordAlreadySet(input.userId);
    }

    const issued = await this.#dependencies.issueVerificationCode.execute({
      userId: input.userId,
      type: "PASSWORD_SETUP",
    });
    await this.#dependencies.sendVerificationCode.execute({
      userId: input.userId,
      email: user.email,
      code: issued.code,
      type: "PASSWORD_SETUP",
    });

    return {
      message: "비밀번호 설정 코드가 이메일로 발송되었습니다.",
    };
  }
}
