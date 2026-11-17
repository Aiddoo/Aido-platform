import type { SupportedLocale } from "@aido/api/vocabulary";

import type { AccountProvider } from "#api/modules/identity/linked-accounts/domain/linked-accounts.constants";
import type { ProviderAccountId } from "#api/modules/identity/linked-accounts/domain/provider-account-id.vo";
import { REQUEST_ORIGIN_DEFAULTS } from "#api/modules/identity/shared/domain/request-metadata.constants";
import { generateRandomName } from "#api/modules/identity/users/domain/random-name.domain-service";
import { SECURITY_EVENT, TERMS_VERSION } from "#api/modules/identity/users/domain/users.constants";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { UnitOfWorkPort } from "#api/shared/application/ports/unit-of-work.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { SecurityLogRepositoryPort } from "../../../users/application/ports/security-log.repository.port.js";
import type { ProvisionUserUseCase } from "../../../users/application/use-cases/provision-user.use-case.js";

const MAXIMUM_NAME_LENGTH = 20;

export interface RegisterSocialUserCommand {
  readonly email: string;
  readonly provider: AccountProvider;
  readonly providerAccountId: ProviderAccountId;
  readonly userName?: string;
  readonly profileImage?: string;
  readonly locale: SupportedLocale;
}

interface RegisterSocialUserDependencies {
  readonly unitOfWork: Pick<UnitOfWorkPort, "run">;
  readonly provisionUserUseCase: Pick<ProvisionUserUseCase, "execute">;
  readonly securityLogRepository: Pick<SecurityLogRepositoryPort, "create">;
  readonly clock: ClockPort;
}

/** 처음 보는 공급자 계정으로 활성 사용자를 만들고 가입 보안 기록을 남긴다. */
export class RegisterSocialUserUseCase {
  readonly #dependencies: RegisterSocialUserDependencies;

  constructor(dependencies: RegisterSocialUserDependencies) {
    this.#dependencies = dependencies;
  }

  execute(command: RegisterSocialUserCommand): Promise<{ id: string; name: string }> {
    const { unitOfWork, provisionUserUseCase, securityLogRepository, clock } = this.#dependencies;
    return unitOfWork.run(async () => {
      const effectiveName = command.userName
        ? command.userName.slice(0, MAXIMUM_NAME_LENGTH)
        : generateRandomName();
      const currentTime = clock.now();

      const user = await provisionUserUseCase.execute({
        email: command.email,
        status: "ACTIVE",
        emailVerifiedAt: currentTime,
        account: {
          kind: "oauth",
          provider: command.provider,
          providerAccountId: command.providerAccountId.value,
        },
        profile: { name: effectiveName, profileImage: command.profileImage },
        consent: {
          termsAgreedAt: currentTime,
          privacyAgreedAt: currentTime,
          agreedTermsVersion: TERMS_VERSION.CURRENT,
          // OAuth 가입 시 선택 동의 화면이 없으므로 마케팅 동의를 자동 처리하지 않는다.
        },
        locale: command.locale,
      });

      await securityLogRepository.create({
        userId: UserId.reconstitute(user.id),
        event: SECURITY_EVENT.REGISTRATION,
        ipAddress: REQUEST_ORIGIN_DEFAULTS.UNKNOWN_IP,
        userAgent: REQUEST_ORIGIN_DEFAULTS.UNKNOWN_USER_AGENT,
        metadata: { provider: command.provider },
      });

      return { id: user.id, name: effectiveName };
    });
  }
}
