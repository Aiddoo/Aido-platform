import { LinkOAuthIdentityUseCase } from "#api/modules/identity/auth/application/use-cases/link-oauth-identity.use-case";
import { NotifyOAuthSignupUseCase } from "#api/modules/identity/auth/application/use-cases/notify-oauth-signup.use-case";
import type { AccountProvider } from "#api/modules/identity/auth/domain/auth.constants";
import { InMemoryAuthOAuthStateRepository } from "#test/doubles/identity/in-memory-auth-oauth-state.repository";
import type { OAuthIdentityProviders } from "#test/mocks/fake-oauth-provider-registry";
import { CountingOAuthIdentityProvider } from "#test/mocks/ports/auth-oauth.stub";

import { createAuthCredentialFixture } from "./auth-credential.fixture.js";

export function createAuthOAuthFixture(
  provider: AccountProvider = "GOOGLE",
  options: Parameters<typeof createAuthCredentialFixture>[0] = {},
) {
  const fixture = createAuthCredentialFixture(options);
  const identityProvider = new CountingOAuthIdentityProvider(provider);
  const registry: OAuthIdentityProviders = new Map([[provider, identityProvider]]);
  const oauthStateRepository = new InMemoryAuthOAuthStateRepository();
  const linkOAuthIdentity = new LinkOAuthIdentityUseCase(fixture);
  const oauthSignupNotifier = new NotifyOAuthSignupUseCase(fixture);
  return {
    ...fixture,
    identityProvider,
    registry,
    oauthStateRepository,
    linkOAuthIdentity,
    oauthSignupNotifier,
  };
}
