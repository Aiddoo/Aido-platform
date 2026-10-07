import type { OAuthIdentityProviderRegistry } from "#api/modules/identity/application/ports/auth/oauth-identity-provider.port";
import { LinkOAuthIdentity } from "#api/modules/identity/application/services/auth/link-oauth-identity.service";
import type { AccountProvider } from "#api/modules/identity/domain/types/auth/auth.types";
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
  return { ...fixture, identityProvider, registry, oauthStateRepository, linkOAuthIdentity };
}
