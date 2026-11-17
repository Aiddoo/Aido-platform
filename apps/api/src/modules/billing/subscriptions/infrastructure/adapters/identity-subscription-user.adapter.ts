import { Injectable } from "@nestjs/common";

import {
  StoreAppUserId,
  StoreAppUserReaderPort,
} from "#api/modules/identity/users/identity-users.public";

import { SubscriptionUserReaderPort } from "../../application/ports/subscription-user.reader.port.js";
import type { SubscriptionUserReadModel } from "../../application/read-models/subscription-user.read-model.js";
import type { StoreCustomerId } from "../../domain/store-customer-id.vo.js";

// 사용자 행은 identity가 소유한다. 별칭·User.id 매칭 규칙도 identity 조회 포트가 정한다
@Injectable()
export class IdentitySubscriptionUserAdapter extends SubscriptionUserReaderPort {
  readonly #storeAppUsers: StoreAppUserReaderPort;

  constructor(storeAppUsers: StoreAppUserReaderPort) {
    super();
    this.#storeAppUsers = storeAppUsers;
  }

  async findFirstByStoreCustomerIds(
    customerIds: readonly StoreCustomerId[],
  ): Promise<SubscriptionUserReadModel | null> {
    const [first] = await this.listByStoreCustomerIds(customerIds);
    return first ?? null;
  }

  listByStoreCustomerIds(
    customerIds: readonly StoreCustomerId[],
  ): Promise<SubscriptionUserReadModel[]> {
    return this.#storeAppUsers.listByStoreAppUserIds(
      customerIds.map((customerId) => StoreAppUserId.reconstitute(customerId.value)),
    );
  }
}
