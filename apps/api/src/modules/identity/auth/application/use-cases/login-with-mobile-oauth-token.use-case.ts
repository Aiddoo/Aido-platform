import type { SocialLoginResult } from "../read-models/auth-result.read-model.js";
import type {
  LoginWithOAuthTokenUseCase,
  LoginWithOAuthTokenCommand,
} from "./login-with-oauth-token.use-case.js";
import type { NotifyOAuthSignupUseCase } from "./notify-oauth-signup.use-case.js";

interface LoginWithMobileOAuthTokenDependencies {
  readonly loginWithOAuthToken: Pick<LoginWithOAuthTokenUseCase, "execute">;
  readonly oauthSignupNotifier: Pick<NotifyOAuthSignupUseCase, "notify">;
}

export class LoginWithMobileOAuthTokenUseCase {
  readonly #dependencies: LoginWithMobileOAuthTokenDependencies;

  constructor(dependencies: LoginWithMobileOAuthTokenDependencies) {
    this.#dependencies = dependencies;
  }

  async execute(input: LoginWithOAuthTokenCommand): Promise<SocialLoginResult> {
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
