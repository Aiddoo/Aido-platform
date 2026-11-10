import type { OAuthIdentityProviderRegistry } from "#api/modules/identity/auth/application/ports/oauth-identity-provider.port";
import { LinkOAuthIdentity } from "#api/modules/identity/auth/application/use-cases/link-oauth-identity.use-case";
import { OAuthSignupNotifier } from "#api/modules/identity/auth/application/use-cases/notify-oauth-signup.use-case";
import type { AccountProvider } from "#api/modules/identity/auth/domain/identity.constants";
import {
  CountingOAuthIdentityProvider,
  StubAuthOAuthStateRepository,
} from "#test/mocks/ports/auth-oauth.stub";

import { createAuthCredentialFixture } from "./auth-credential.fixture.js";

export function createAuthOAuthFixture(
  provider: AccountProvider = "GOOGLE",
  options: Parameters<typeof createAuthCredentialFixture>[0] = {},
) {
  const fixture = createAuthCredentialFixture(options);
  const identityProvider = new CountingOAuthIdentityProvider(provider);
  const registry: OAuthIdentityProviderRegistry = new Map([[provider, identityProvider]]);
  const oauthStateRepository = new StubAuthOAuthStateRepository();
  const linkOAuthIdentity = new LinkOAuthIdentity(fixture);
  const oauthSignupNotifier = new OAuthSignupNotifier(fixture);
  return {
    ...fixture,
    identityProvider,
    registry,
    oauthStateRepository,
    linkOAuthIdentity,
    oauthSignupNotifier,
  };
}
