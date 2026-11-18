import { uniq, uniqBy } from "es-toolkit";

import { SubscriptionUserReaderPort } from "#api/modules/billing/subscriptions/application/ports/subscription-user.reader.port";
import type { SubscriptionUserReadModel } from "#api/modules/billing/subscriptions/application/read-models/subscription-user.read-model";
import type { StoreCustomerId } from "#api/modules/billing/subscriptions/domain/store-customer-id.vo";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

export interface InMemorySubscriptionUser {
  readonly id: string;
  readonly email: string;
  readonly name: string | null;
  /** 처음 User.id가 아닌 RevenueCat 별칭 */
  readonly appUserAlias?: string;
}

export class InMemorySubscriptionUserReader extends SubscriptionUserReaderPort {
  readonly #users: readonly InMemorySubscriptionUser[];

  constructor(users: readonly InMemorySubscriptionUser[] = []) {
    super();
    this.#users = users;
  }

  async findFirstByStoreCustomerIds(
    customerIds: readonly StoreCustomerId[],
  ): Promise<SubscriptionUserReadModel | null> {
    const [first] = await this.listByStoreCustomerIds(customerIds);
    return first ?? null;
  }

  async listByStoreCustomerIds(
    customerIds: readonly StoreCustomerId[],
  ): Promise<SubscriptionUserReadModel[]> {
    const appUserIds = customerIds.map((customerId) => customerId.value);
    const matched = uniq(appUserIds).flatMap((appUserId) => {
      const user =
        this.#users.find((candidate) => candidate.appUserAlias === appUserId) ??
        this.#users.find((candidate) => candidate.id === appUserId);
      return user == null ? [] : [user];
    });
    return uniqBy(matched, (user) => user.id).map((user) => ({
      id: UserId.reconstitute(user.id),
      email: user.email,
      name: user.name,
    }));
  }
}
