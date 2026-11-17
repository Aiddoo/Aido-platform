import { Injectable } from "@nestjs/common";

import { StoreAppUserReaderPort } from "#api/modules/identity/users/identity-users.public";

import { SubscriptionUserReaderPort } from "../../application/ports/subscription-user.reader.port.js";
import type { SubscriptionUserReadModel } from "../../application/read-models/subscription-user.read-model.js";

// 사용자 행은 identity가 소유한다. 별칭·User.id 매칭 규칙도 identity 조회 포트가 정한다
@Injectable()
export class IdentitySubscriptionUserAdapter extends SubscriptionUserReaderPort {
  readonly #storeAppUsers: StoreAppUserReaderPort;

  constructor(storeAppUsers: StoreAppUserReaderPort) {
    super();
    this.#storeAppUsers = storeAppUsers;
  }

  async findFirstByAppUserIds(
    appUserIds: readonly string[],
  ): Promise<SubscriptionUserReadModel | null> {
    const [first] = await this.listByAppUserIds(appUserIds);
    return first ?? null;
  }

  listByAppUserIds(appUserIds: readonly string[]): Promise<SubscriptionUserReadModel[]> {
    return this.#storeAppUsers.listByStoreAppUserIds(appUserIds);
  }
}
