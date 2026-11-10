import type { SocialLoginResult } from "../read-models/auth-result.read-model.js";
import type {
  LoginWithOAuthToken,
  LoginWithOAuthTokenInput,
} from "./login-with-oauth-token.use-case.js";
import type { OAuthSignupNotifier } from "./notify-oauth-signup.use-case.js";

interface LoginWithMobileOAuthTokenDependencies {
  readonly loginWithOAuthToken: Pick<LoginWithOAuthToken, "execute">;
  readonly oauthSignupNotifier: Pick<OAuthSignupNotifier, "notify">;
}

export class LoginWithMobileOAuthToken {
  readonly #dependencies: LoginWithMobileOAuthTokenDependencies;

  constructor(dependencies: LoginWithMobileOAuthTokenDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: LoginWithOAuthTokenInput): Promise<SocialLoginResult> {
    const result = await this.#dependencies.loginWithOAuthToken.execute(input);
    if (result.isNewUser) {
      await this.#dependencies.oauthSignupNotifier.notify({
        userId: result.userId,
        provider: input.provider,
        device: input.metadata?.device,
      });
    }
    return result;
  }
}
