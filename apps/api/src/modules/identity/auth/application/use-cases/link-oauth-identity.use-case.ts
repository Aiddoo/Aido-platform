import { SECURITY_EVENT } from "@aido/api/vocabulary";

import {
  AuthPersistenceConflict,
  oauthAccountAlreadyLinked,
} from "#api/modules/identity/auth/application/auth.errors";
import {
  AUTH_DEFAULTS,
  type AccountProvider,
} from "#api/modules/identity/auth/domain/auth.constants";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import { type AuthAccountRepositoryPort } from "../ports/auth-account.repository.port.js";
import { type AuthSecurityLogRepositoryPort } from "../ports/auth-security-log.repository.port.js";
import type { RequestMetadata } from "../read-models/auth-result.read-model.js";

export interface LinkOAuthIdentityCommand {
  readonly userId: string;
  readonly provider: AccountProvider;
  readonly providerAccountId: string;
  readonly metadata?: RequestMetadata;
}

interface LinkOAuthIdentityDependencies {
  readonly accountRepository: Pick<
    AuthAccountRepositoryPort,
    "findByProviderAccountId" | "createOAuthAccount"
  >;
  readonly securityLogRepository: Pick<AuthSecurityLogRepositoryPort, "create">;
}

export class LinkOAuthIdentityUseCase {
  readonly #dependencies: LinkOAuthIdentityDependencies;

  constructor(dependencies: LinkOAuthIdentityDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: LinkOAuthIdentityCommand): Promise<{ message: string; linked: boolean }> {
    const { provider, providerAccountId, metadata } = input;
    const userId = UserId.reconstitute(input.userId);
    const existingAccount = await this.#dependencies.accountRepository.findByProviderAccountId(
      provider,
      providerAccountId,
    );
    if (existingAccount != null) {
      if (existingAccount.userId !== input.userId) {
        throw oauthAccountAlreadyLinked(provider, providerAccountId);
      }
      return { message: "이미 연결된 계정입니다.", linked: false };
    }
    try {
      await this.#dependencies.accountRepository.createOAuthAccount({
        userId,
        provider,
        providerAccountId,
      });
      await this.#dependencies.securityLogRepository.create({
        userId,
        event: SECURITY_EVENT.OAUTH_LINKED,
        ipAddress: metadata?.ip ?? AUTH_DEFAULTS.UNKNOWN_IP,
        userAgent: metadata?.userAgent ?? AUTH_DEFAULTS.UNKNOWN_USER_AGENT,
        metadata: { provider, providerAccountId },
      });
    } catch (error) {
      if (
        error instanceof AuthPersistenceConflict &&
        error.kind === "OAUTH_ACCOUNT_ALREADY_LINKED"
      ) {
        throw oauthAccountAlreadyLinked(provider, providerAccountId);
      }
      throw error;
    }
    return { message: "계정이 연결되었습니다.", linked: true };
  }
}
