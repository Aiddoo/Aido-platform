import { Injectable } from "@nestjs/common";

import {
  type OAuthIdentityProviderPort,
  OAuthIdentityProviderRegistryPort,
} from "../../application/ports/oauth-identity-provider.port.js";
import type { AccountProvider } from "../../domain/auth.constants.js";
import { AppleOAuthIdentityAdapter } from "./apple-oauth-identity.adapter.js";
import { GoogleOAuthIdentityAdapter } from "./google-oauth-identity.adapter.js";
import { KakaoOAuthIdentityAdapter } from "./kakao-oauth-identity.adapter.js";
import { NaverOAuthIdentityAdapter } from "./naver-oauth-identity.adapter.js";

@Injectable()
export class OAuthIdentityProviderRegistryAdapter extends OAuthIdentityProviderRegistryPort {
  readonly #providers: ReadonlyMap<AccountProvider, OAuthIdentityProviderPort>;

  constructor(
    apple: AppleOAuthIdentityAdapter,
    google: GoogleOAuthIdentityAdapter,
    kakao: KakaoOAuthIdentityAdapter,
    naver: NaverOAuthIdentityAdapter,
  ) {
    super();
    this.#providers = new Map(
      [apple, google, kakao, naver].map((provider) => [provider.provider, provider]),
    );
  }

  get(provider: AccountProvider): OAuthIdentityProviderPort | undefined {
    return this.#providers.get(provider);
  }
}
