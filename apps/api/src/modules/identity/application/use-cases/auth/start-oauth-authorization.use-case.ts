import type { OAUTH_PROVIDERS } from "@aido/api/vocabulary";

import type { OAuthMode } from "../../ports/auth/oauth-identity-provider.port.js";
import type { OAuthWorkflow } from "../../workflows/auth/oauth.workflow.js";

type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];
type WebOAuthProvider = Exclude<OAuthProvider, "APPLE">;
type StartAuthorizationMethod =
  | "generateGoogleAuthUrlWithState"
  | "generateKakaoAuthUrlWithState"
  | "generateNaverAuthUrlWithState";

const START_AUTHORIZATION_METHOD_BY_PROVIDER = {
  GOOGLE: "generateGoogleAuthUrlWithState",
  KAKAO: "generateKakaoAuthUrlWithState",
  NAVER: "generateNaverAuthUrlWithState",
} as const satisfies Record<WebOAuthProvider, StartAuthorizationMethod>;

interface StartOAuthAuthorizationDependencies {
  readonly workflow: OAuthWorkflow;
}

export class StartOAuthAuthorization {
  readonly #dependencies: StartOAuthAuthorizationDependencies;

  constructor(dependencies: StartOAuthAuthorizationDependencies) {
    this.#dependencies = dependencies;
  }
  execute(
    provider: WebOAuthProvider,
    state: string,
    clientRedirectUri?: string,
    mode?: OAuthMode,
    initiatingUserId?: string,
  ): Promise<string> {
    const methodName = START_AUTHORIZATION_METHOD_BY_PROVIDER[provider];
    return this.#dependencies.workflow[methodName](
      state,
      clientRedirectUri,
      mode,
      initiatingUserId,
    );
  }
}
