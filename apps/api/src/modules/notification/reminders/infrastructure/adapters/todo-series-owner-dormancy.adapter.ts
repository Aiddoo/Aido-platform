import { Inject, Injectable } from "@nestjs/common";

import {
  EntitlementReaderPort,
  isExemptFromDormancy,
} from "#api/modules/access/entitlements/access-entitlements.public";
import { UserActivityReaderPort } from "#api/modules/identity/identity-user-access.public";
import { isSeriesOwnerDormant } from "#api/modules/planning/todo-series/planning-todo-series-dormancy.public";
import { now } from "#api/shared/domain/date/utils/core";
import { toDateString } from "#api/shared/domain/date/utils/format";
import { instantToDate } from "#api/shared/domain/time/instant";

import { TodoSeriesOwnerDormancyPort } from "../../application/ports/todo-series-owner-dormancy.port.js";

/** planning이 notification을 조립하므로 모듈 대신 순수 정책만 받아 쓴다. */
@Injectable()
export class TodoSeriesOwnerDormancyAdapter extends TodoSeriesOwnerDormancyPort {
  readonly #activityReader: UserActivityReaderPort;
  readonly #entitlementReader: Pick<EntitlementReaderPort, "getEntitlements">;

  constructor(
    @Inject(UserActivityReaderPort) activityReader: UserActivityReaderPort,
    @Inject(EntitlementReaderPort) entitlementReader: Pick<
      EntitlementReaderPort,
      "getEntitlements"
    >,
  ) {
    super();
    this.#activityReader = activityReader;
    this.#entitlementReader = entitlementReader;
  }

  async findDormantSince(userId: string): Promise<string | null> {
    const [account] = await this.#activityReader.findActiveAccounts([userId]);
    if (account == null) {
      return null;
    }
    // 휴면 판정은 아직 Date로 계산한다
    const owner = {
      lastActiveAt: account.lastActiveAt == null ? null : instantToDate(account.lastActiveAt),
      signedUpAt: instantToDate(account.signedUpAt),
      timezone: account.timezone,
    };
    if (!isSeriesOwnerDormant(owner, now())) {
      return null;
    }
    const { plan } = await this.#entitlementReader.getEntitlements(userId);
    return isExemptFromDormancy(plan) ? null : toDateString(owner.lastActiveAt ?? owner.signedUpAt);
  }
}
