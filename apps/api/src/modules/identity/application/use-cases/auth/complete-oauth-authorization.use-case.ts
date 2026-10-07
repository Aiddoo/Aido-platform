import type { OAUTH_PROVIDERS } from "@aido/api/vocabulary";

import type { RequestMetadata } from "../../types/auth/index.js";
import type { OAuthWorkflow } from "../../workflows/auth/oauth.workflow.js";

type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];
type WebOAuthProvider = Exclude<OAuthProvider, "APPLE">;

interface CompleteOAuthAuthorizationDependencies {
  readonly workflow: OAuthWorkflow;
}

export class CompleteOAuthAuthorization {
  readonly #dependencies: CompleteOAuthAuthorizationDependencies;

  constructor(dependencies: CompleteOAuthAuthorizationDependencies) {
    this.#dependencies = dependencies;
  }
  execute(
    provider: WebOAuthProvider,
    code: string,
    state: string,
    metadata?: RequestMetadata,
  ): ReturnType<OAuthWorkflow["handleGoogleWebCallbackWithExchangeCode"]> {
    switch (provider) {
      case "GOOGLE":
        return this.#dependencies.workflow.handleGoogleWebCallbackWithExchangeCode(
          code,
          state,
          metadata,
        );
      case "KAKAO":
        return this.#dependencies.workflow.handleKakaoWebCallbackWithExchangeCode(
          code,
          state,
          metadata,
        );
      case "NAVER":
        return this.#dependencies.workflow.handleNaverWebCallbackWithExchangeCode(
          code,
          state,
          metadata,
        );
    }
  }
}
