import { EntitlementService } from "#api/modules/access/application/services/entitlement/entitlement.service";
import { UserFixture } from "#test/fixtures/user.fixture";
import { StubEntitlementDatabase, StubEntitlementCache } from "#test/mocks/ports/entitlement.stub";

export function createEntitlementFixture(
  input: { role?: string; subscriptionStatus?: string; exists?: boolean } = {},
) {
  const user = UserFixture.create();
  const database = new StubEntitlementDatabase();
  const cache = new StubEntitlementCache();
  if (input.exists !== false)
    database.users.set(user.id, {
      role: input.role ?? "USER",
      subscriptionStatus: input.subscriptionStatus ?? "FREE",
    });
  const service = new EntitlementService({ database, cacheService: cache });
  return { userId: user.id, database, cache, service };
}
