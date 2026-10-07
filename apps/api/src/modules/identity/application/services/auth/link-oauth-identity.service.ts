import { ErrorCode } from "@aido/api/errors";
import { match } from "ts-pattern";

import {
  AUTH_DEFAULTS,
  SECURITY_EVENT,
} from "#api/modules/identity/domain/constants/auth/auth.constants";
import type { AccountProvider } from "#api/modules/identity/domain/types/auth/auth.types";
import { ApplicationException } from "#api/shared/domain/exceptions/application.exception";

import {
  AuthPersistenceConflict,
  type AuthAccountRepositoryPort,
  type AuthSecurityLogRepositoryPort,
} from "../../ports/auth/auth-persistence.port.js";
import type { RequestMetadata } from "../../types/auth/index.js";

export interface LinkOAuthIdentityInput {
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

export class LinkOAuthIdentity {
  readonly #dependencies: LinkOAuthIdentityDependencies;

  constructor(dependencies: LinkOAuthIdentityDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: LinkOAuthIdentityInput): Promise<{ message: string; linked: boolean }> {
    const { userId, provider, providerAccountId, metadata } = input;
    const existingAccount = await this.#dependencies.accountRepository.findByProviderAccountId(
      provider,
      providerAccountId,
    );
    if (existingAccount !== null) {
      if (existingAccount.userId !== userId) throw this.#alreadyLinked(input);
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
      if (error instanceof AuthPersistenceConflict && error.kind === "OAUTH_ACCOUNT_ALREADY_LINKED")
        throw this.#alreadyLinked(input);
      throw error;
    }
    return { message: "계정이 연결되었습니다.", linked: true };
  }

  #alreadyLinked(input: LinkOAuthIdentityInput): ApplicationException {
    const { provider, providerAccountId } = input;
    return match(provider)
      .with(
        "KAKAO",
        () => new ApplicationException(ErrorCode.KAKAO_0306, { kakaoId: providerAccountId }),
      )
      .with(
        "APPLE",
        () => new ApplicationException(ErrorCode.APPLE_0355, { appleId: providerAccountId }),
      )
      .with(
        "GOOGLE",
        () => new ApplicationException(ErrorCode.GOOGLE_0405, { googleId: providerAccountId }),
      )
      .with(
        "NAVER",
        () => new ApplicationException(ErrorCode.NAVER_0455, { naverId: providerAccountId }),
      )
      .with(
        "CREDENTIAL",
        () => new ApplicationException(ErrorCode.USER_0604, { provider, providerAccountId }),
      )
      .exhaustive();
  }
}
