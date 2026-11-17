import type { SupportedLocale } from "@aido/api/vocabulary";

import { accountDeleted } from "#api/modules/identity/users/application/users.errors";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { UserRepositoryPort } from "../../../users/application/ports/user.repository.port.js";
import { userNotFound } from "../../../users/application/users.errors.js";
import type { IssueVerificationCodeUseCase } from "../../../verifications/application/use-cases/issue-verification-code.use-case.js";
import type { SendVerificationCodeUseCase } from "../../../verifications/application/use-cases/send-verification-code.use-case.js";
import { passwordAlreadySet } from "../linked-accounts.errors.js";
import type { LinkedAccountsRepositoryPort } from "../ports/linked-accounts.repository.port.js";

export interface RequestPasswordSetupCodeCommand {
  readonly userId: string;
  /** 코드 메일을 쓸 언어. 요청 응답과 같은 언어다 */
  readonly emailLocale: SupportedLocale;
}

interface RequestPasswordSetupCodeDependencies {
  readonly userRepository: Pick<UserRepositoryPort, "findById">;
  readonly accountRepository: Pick<LinkedAccountsRepositoryPort, "findByUserIdAndProvider">;
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
      emailLocale: input.emailLocale,
    });

    return {
      message: "비밀번호 설정 코드가 이메일로 발송되었습니다.",
    };
  }
}
