import { Inject, Injectable } from "@nestjs/common";

import {
  EntitlementReaderPort,
  isExemptFromDormancy,
} from "#api/modules/access/feature-grants/access-feature-grants.public";
import { UserActivityReaderPort } from "#api/modules/identity/users/identity-users.public";
import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type { TodoSeriesOwnerPort } from "../../application/ports/todo-series-owner.port.js";
import type { SeriesOwnerActivity } from "../../domain/series-dormancy.domain-service.js";

@Injectable()
export class TodoSeriesOwnerAdapter implements TodoSeriesOwnerPort {
  readonly #activityReader: UserActivityReaderPort;
  readonly #entitlementReader: Pick<EntitlementReaderPort, "getEntitlements">;

  constructor(
    @Inject(UserActivityReaderPort) activityReader: UserActivityReaderPort,
    @Inject(EntitlementReaderPort) entitlementReader: Pick<
      EntitlementReaderPort,
      "getEntitlements"
    >,
  ) {
    this.#activityReader = activityReader;
    this.#entitlementReader = entitlementReader;
  }

  async listOperatingOwners(
    userIds: readonly UserId[],
  ): Promise<ReadonlyMap<string, SeriesOwnerActivity>> {
    const accounts = await this.#activityReader.listActiveAccounts(userIds);
    return new Map(
      accounts.map((account) => [
        account.userId.value,
        {
          lastActiveAt: account.lastActiveAt,
          signedUpAt: account.signedUpAt,
          timezone: account.timezone,
        },
      ]),
    );
  }

  async isExemptFromDormancy(userId: UserId): Promise<boolean> {
    const { plan } = await this.#entitlementReader.getEntitlements(userId);
    return isExemptFromDormancy(plan);
  }
}
