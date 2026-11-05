import type { NotifyOAuthSignup } from "../../services/auth/notify-oauth-signup.service.js";
import type { SocialLoginResult } from "../../types/auth/index.js";
import type {
  LoginWithOAuthToken,
  LoginWithOAuthTokenInput,
} from "./login-with-oauth-token.use-case.js";

interface LoginWithMobileOAuthTokenDependencies {
  readonly loginWithOAuthToken: Pick<LoginWithOAuthToken, "execute">;
  readonly notifyOAuthSignup: Pick<NotifyOAuthSignup, "execute">;
}

export class LoginWithMobileOAuthToken {
  readonly #dependencies: LoginWithMobileOAuthTokenDependencies;

  constructor(dependencies: LoginWithMobileOAuthTokenDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: LoginWithOAuthTokenInput): Promise<SocialLoginResult> {
    const result = await this.#dependencies.loginWithOAuthToken.execute(input);
    if (result.isNewUser) {
      await this.#dependencies.notifyOAuthSignup.execute({
        userId: result.userId,
        provider: input.provider,
        device: input.metadata?.device,
      });
    }
    return result;
  }
}
