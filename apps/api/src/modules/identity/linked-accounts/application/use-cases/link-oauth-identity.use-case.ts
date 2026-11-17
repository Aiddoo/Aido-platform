import { SECURITY_EVENT } from "@aido/api/vocabulary";

import { REQUEST_ORIGIN_DEFAULTS } from "#api/modules/identity/shared/domain/request-metadata.constants";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { RequestMetadata } from "../../../shared/domain/request-metadata.constants.js";
import { type SecurityLogRepositoryPort } from "../../../users/application/ports/security-log.repository.port.js";
import { LinkedAccounts } from "../../domain/linked-accounts.aggregate.js";
import type { AccountProvider } from "../../domain/linked-accounts.constants.js";
import { oauthAccountAlreadyLinked } from "../../domain/linked-accounts.errors.js";
import { type LinkedAccountsRepositoryPort } from "../ports/linked-accounts.repository.port.js";

export interface LinkOAuthIdentityCommand {
  readonly userId: string;
  readonly provider: AccountProvider;
  readonly providerAccountId: string;
  readonly metadata?: RequestMetadata;
}

interface LinkOAuthIdentityDependencies {
  readonly accountRepository: Pick<
    LinkedAccountsRepositoryPort,
    "findByUserId" | "nextId" | "save"
  >;
  readonly securityLogRepository: Pick<SecurityLogRepositoryPort, "create">;
  readonly clock: ClockPort;
}

// 호출자가 사용자 잠금(UserMutationLockPort)을 잡은 트랜잭션 안에서 부른다
export class LinkOAuthIdentityUseCase {
  readonly #dependencies: LinkOAuthIdentityDependencies;

  constructor(dependencies: LinkOAuthIdentityDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: LinkOAuthIdentityCommand): Promise<{ message: string; linked: boolean }> {
    const { provider, providerAccountId, metadata } = input;
    const { accountRepository, clock } = this.#dependencies;
    const userId = UserId.reconstitute(input.userId);
    const accounts =
      (await accountRepository.findByUserId(userId)) ?? LinkedAccounts.create(userId);
    const linked = accounts.link({
      id: await accountRepository.nextId(),
      provider,
      providerAccountId,
      now: clock.now(),
    });
    if (!linked) {
      return { message: "이미 연결된 계정입니다.", linked: false };
    }
    // 잠금은 이 사용자만 막는다. 다른 사용자가 먼저 같은 공급자 계정을 연결했으면 저장이 false다
    if (!(await accountRepository.save(accounts))) {
      throw oauthAccountAlreadyLinked(provider, providerAccountId);
    }
    await this.#dependencies.securityLogRepository.create({
      userId,
      event: SECURITY_EVENT.OAUTH_LINKED,
      ipAddress: metadata?.ip ?? REQUEST_ORIGIN_DEFAULTS.UNKNOWN_IP,
      userAgent: metadata?.userAgent ?? REQUEST_ORIGIN_DEFAULTS.UNKNOWN_USER_AGENT,
      metadata: { provider, providerAccountId },
    });
    return { message: "계정이 연결되었습니다.", linked: true };
  }
}
