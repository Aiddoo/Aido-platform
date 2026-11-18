import { LinkedAccounts } from "#api/modules/identity/linked-accounts/domain/linked-accounts.aggregate";
import type { AccountProvider } from "#api/modules/identity/linked-accounts/domain/linked-accounts.constants";
import type { ProviderAccountId } from "#api/modules/identity/linked-accounts/domain/provider-account-id.vo";
import { oauthAccountLinkConflict } from "#api/modules/identity/shared/domain/identity.errors";
import { SECURITY_EVENT } from "#api/modules/identity/users/domain/users.constants";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { LinkedAccountsRepositoryPort } from "../../../linked-accounts/application/ports/linked-accounts.repository.port.js";
import type { SecurityLogRepositoryPort } from "../../../users/application/ports/security-log.repository.port.js";
import type { UserMutationLockPort } from "../../../users/application/ports/user-mutation-lock.port.js";
import { userNotFound } from "../../../users/application/users.errors.js";

export interface AutoLinkOAuthAccountCommand {
  readonly userId: UserId;
  readonly provider: AccountProvider;
  readonly providerAccountId: ProviderAccountId;
  readonly ip: string;
  readonly userAgent: string;
}

interface AutoLinkOAuthAccountDependencies {
  readonly accountRepository: Pick<
    LinkedAccountsRepositoryPort,
    "findByUserId" | "nextId" | "save"
  >;
  readonly userMutationLock: Pick<UserMutationLockPort, "lockById">;
  readonly securityLogRepository: Pick<SecurityLogRepositoryPort, "create">;
  readonly clock: ClockPort;
}

/**
 * 신뢰하는 공급자가 확인한 이메일이 기존 사용자와 같으면 그 사용자에게 공급자 계정을 연결한다.
 * 호출자가 연 트랜잭션 안에서 사용자 잠금을 잡고 부른다.
 */
export class AutoLinkOAuthAccountUseCase {
  readonly #dependencies: AutoLinkOAuthAccountDependencies;

  constructor(dependencies: AutoLinkOAuthAccountDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(command: AutoLinkOAuthAccountCommand): Promise<void> {
    const { accountRepository, userMutationLock, securityLogRepository, clock } =
      this.#dependencies;
    const { userId, provider } = command;
    if (!(await userMutationLock.lockById(userId))) {
      throw userNotFound(userId.value);
    }
    const accounts =
      (await accountRepository.findByUserId(userId)) ?? LinkedAccounts.create(userId);
    const linked = accounts.link({
      id: await accountRepository.nextId(),
      provider,
      providerAccountId: command.providerAccountId.value,
      now: clock.now(),
    });
    // 같은 자동 연결 로그인이 먼저 커밋했으면 이미 연결돼 있어 그대로 로그인한다
    if (!linked) {
      return;
    }
    if (!(await accountRepository.save(accounts))) {
      throw oauthAccountLinkConflict();
    }

    await securityLogRepository.create({
      userId,
      event: SECURITY_EVENT.OAUTH_AUTO_LINKED,
      ipAddress: command.ip,
      userAgent: command.userAgent,
      metadata: {
        provider,
        autoLinked: true,
        reason: "trusted_provider_verified_email",
      },
    });
  }
}
