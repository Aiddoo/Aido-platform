import { LinkOAuthIdentityUseCase } from "#api/modules/identity/linked-accounts/application/use-cases/link-oauth-identity.use-case";
import type { AccountProvider } from "#api/modules/identity/linked-accounts/domain/linked-accounts.constants";
import { AutoLinkOAuthAccountUseCase } from "#api/modules/identity/sessions/application/use-cases/auto-link-oauth-account.use-case";
import { RegisterSocialUserUseCase } from "#api/modules/identity/sessions/application/use-cases/register-social-user.use-case";
import { NotifyOAuthSignupUseCase } from "#api/modules/identity/users/application/use-cases/notify-oauth-signup.use-case";
import { FakeOAuthIdentityProviderRegistry } from "#test/doubles/identity/fake-oauth-provider-registry";
import { InMemoryOAuthStateRepository } from "#test/doubles/identity/in-memory-oauth-state.repository";
import { CountingOAuthIdentityProvider } from "#test/doubles/identity/stub-oauth-identity-provider";
import { createAuthCredentialFixture } from "#test/fixtures/identity/auth-credential-scenario.fixture";

export function createAuthOAuthFixture(
  provider: AccountProvider = "GOOGLE",
  options: Parameters<typeof createAuthCredentialFixture>[0] = {},
) {
  const fixture = createAuthCredentialFixture(options);
  const identityProvider = new CountingOAuthIdentityProvider(provider);
  const registry = new FakeOAuthIdentityProviderRegistry(new Map([[provider, identityProvider]]));
  const oauthStateRepository = new InMemoryOAuthStateRepository();
  const linkOAuthIdentity = new LinkOAuthIdentityUseCase(fixture);
  const registerSocialUser = new RegisterSocialUserUseCase(fixture);
  const autoLinkOAuthAccount = new AutoLinkOAuthAccountUseCase(fixture);
  const oauthSignupNotifier = new NotifyOAuthSignupUseCase(fixture);
  return {
    ...fixture,
    identityProvider,
    registry,
    oauthStateRepository,
    linkOAuthIdentity,
    registerSocialUser,
    autoLinkOAuthAccount,
    oauthSignupNotifier,
  };
}
