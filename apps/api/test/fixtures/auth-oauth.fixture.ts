import { LinkOAuthIdentityUseCase } from "#api/modules/identity/linked-accounts/application/use-cases/link-oauth-identity.use-case";
import type { AccountProvider } from "#api/modules/identity/linked-accounts/domain/linked-accounts.constants";
import { NotifyOAuthSignupUseCase } from "#api/modules/identity/users/application/use-cases/notify-oauth-signup.use-case";
import { InMemoryOAuthStateRepository } from "#test/doubles/identity/in-memory-oauth-state.repository";
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
  const oauthStateRepository = new InMemoryOAuthStateRepository();
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
