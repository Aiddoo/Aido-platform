import { GetResolvedAccessUseCase } from "#api/modules/access/entitlements/application/use-cases/get-resolved-access.use-case";
import { EntitlementReaderAdapter } from "#api/modules/access/entitlements/infrastructure/adapters/entitlement-reader.adapter";
import type { ClockPort } from "#api/shared/application/ports/clock.port";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";
import {
  InMemoryAccessStateReader,
  type InMemoryAccessUser,
} from "#test/doubles/access/in-memory-access-state.reader";
import { InMemoryEntitlementCache } from "#test/doubles/access/in-memory-entitlement-cache";
import { DateClock } from "#test/doubles/platform/date-clock";

import {
  ACCESS_FIXTURE_USER_ID,
  createAccessUserFixture,
  type AccessUserInput,
} from "./access-user.fixture.js";

/**
 * 메모리 대역 위의 실제 권한 판단(GetResolvedAccessUseCase·EntitlementReaderAdapter).
 * exists false면 사용자 행이 없다. 시계를 주지 않으면 vi.setSystemTime을 따르는 DateClock이다.
 */
export function createEntitlementFixture(
  input: AccessUserInput & { readonly exists?: boolean } = {},
  options: { readonly clock?: ClockPort } = {},
) {
  const userId = UserId.reconstitute(ACCESS_FIXTURE_USER_ID);
  const users = new Map<string, InMemoryAccessUser>();
  if (input.exists !== false) {
    users.set(userId.value, createAccessUserFixture(input));
  }
  const accessStateReader = new InMemoryAccessStateReader(users);
  const cache = new InMemoryEntitlementCache();
  const clock = options.clock ?? new DateClock();
  const getResolvedAccess = new GetResolvedAccessUseCase({
    accessStateReader,
    entitlementCache: cache,
    clock,
  });
  return {
    userId,
    users,
    accessStateReader,
    cache,
    clock,
    getResolvedAccess,
    reader: new EntitlementReaderAdapter(getResolvedAccess),
  };
}
