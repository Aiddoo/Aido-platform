import { Inject, Injectable } from "@nestjs/common";

import {
  EntitlementReaderPort,
  isExemptFromDormancy,
} from "#api/modules/access/entitlements/access-entitlements.public";
import { UserActivityReaderPort } from "#api/modules/identity/identity-user-access.public";
import { instantToDate } from "#api/shared/domain/time/instant";

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

  async findOperatingOwners(
    userIds: readonly string[],
  ): Promise<ReadonlyMap<string, SeriesOwnerActivity>> {
    const accounts = await this.#activityReader.findActiveAccounts(userIds);
    // 휴면 판정은 아직 Date로 계산한다
    return new Map(
      accounts.map((account) => [
        account.userId,
        {
          lastActiveAt: account.lastActiveAt == null ? null : instantToDate(account.lastActiveAt),
          signedUpAt: instantToDate(account.signedUpAt),
          timezone: account.timezone,
        },
      ]),
    );
  }

  async isExemptFromDormancy(userId: string): Promise<boolean> {
    const { plan } = await this.#entitlementReader.getEntitlements(userId);
    return isExemptFromDormancy(plan);
  }
}
