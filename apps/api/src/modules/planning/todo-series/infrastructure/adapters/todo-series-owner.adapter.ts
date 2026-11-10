import { Inject, Injectable } from "@nestjs/common";

import {
  ENTITLEMENT_READER,
  isExemptFromDormancy,
  type EntitlementReaderPort,
} from "#api/modules/access/access-entitlement.public";
import {
  USER_ACTIVITY_READER,
  type UserActivityReaderPort,
} from "#api/modules/identity/identity-user-access.public";

import type { TodoSeriesOwnerPort } from "../../application/ports/todo-series-owner.port.js";
import type { SeriesOwnerActivity } from "../../domain/series-dormancy.domain-service.js";

@Injectable()
export class TodoSeriesOwnerAdapter implements TodoSeriesOwnerPort {
  readonly #activityReader: UserActivityReaderPort;
  readonly #entitlementReader: Pick<EntitlementReaderPort, "getAccessSnapshot">;

  constructor(
    @Inject(USER_ACTIVITY_READER) activityReader: UserActivityReaderPort,
    @Inject(ENTITLEMENT_READER) entitlementReader: Pick<EntitlementReaderPort, "getAccessSnapshot">,
  ) {
    this.#activityReader = activityReader;
    this.#entitlementReader = entitlementReader;
  }

  async findOperatingOwners(
    userIds: readonly string[],
  ): Promise<ReadonlyMap<string, SeriesOwnerActivity>> {
    const accounts = await this.#activityReader.findActiveAccounts(userIds);
    return new Map(accounts.map((account) => [account.userId, account]));
  }

  async isExemptFromDormancy(userId: string): Promise<boolean> {
    const { tier } = await this.#entitlementReader.getAccessSnapshot(userId);
    return isExemptFromDormancy(tier);
  }
}
