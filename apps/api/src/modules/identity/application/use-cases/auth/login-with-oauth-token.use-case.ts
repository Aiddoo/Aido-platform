import type { OAUTH_PROVIDERS } from "@aido/api/vocabulary";

import type { RequestMetadata } from "../../types/auth/index.js";
import type { OAuthWorkflow } from "../../workflows/auth/oauth.workflow.js";

type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

interface LoginWithOAuthTokenDependencies {
  readonly workflow: OAuthWorkflow;
}

export class LoginWithOAuthToken {
  readonly #dependencies: LoginWithOAuthTokenDependencies;

  constructor(dependencies: LoginWithOAuthTokenDependencies) {
    this.#dependencies = dependencies;
  }
  execute(
    provider: OAuthProvider,
    token: string,
    userName?: string,
    metadata?: RequestMetadata,
    nonce?: string,
  ): ReturnType<OAuthWorkflow["handleAppleMobileLogin"]> {
    switch (provider) {
      case "APPLE":
        return this.#dependencies.workflow.handleAppleMobileLogin(token, userName, metadata, nonce);
      case "GOOGLE":
        return this.#dependencies.workflow.handleGoogleMobileLogin(token, userName, metadata);
      case "KAKAO":
        return this.#dependencies.workflow.handleKakaoMobileLogin(token, userName, metadata);
      case "NAVER":
        return this.#dependencies.workflow.handleNaverMobileLogin(token, userName, metadata);
    }
  }
}
