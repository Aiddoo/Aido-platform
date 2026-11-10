import { Inject, Injectable } from "@nestjs/common";

import {
  ENTITLEMENT_READER,
  isExemptFromDormancy,
  type EntitlementReaderPort,
} from "#api/modules/access/access-entitlement.public";
import { UserActivityReaderPort } from "#api/modules/identity/identity-user-access.public";
import { isSeriesOwnerDormant } from "#api/modules/planning/todo-series/planning-todo-series-dormancy.public";
import { now } from "#api/shared/domain/date/utils/core";
import { toDateString } from "#api/shared/domain/date/utils/format";

import { TodoSeriesOwnerDormancyPort } from "../../application/ports/todo-series-owner-dormancy.port.js";

/** planning이 notification을 조립하므로 모듈 대신 순수 정책만 받아 쓴다. */
@Injectable()
export class TodoSeriesOwnerDormancyAdapter extends TodoSeriesOwnerDormancyPort {
  readonly #activityReader: UserActivityReaderPort;
  readonly #entitlementReader: EntitlementReaderPort;

  constructor(
    @Inject(UserActivityReaderPort) activityReader: UserActivityReaderPort,
    @Inject(ENTITLEMENT_READER) entitlementReader: EntitlementReaderPort,
  ) {
    super();
    this.#activityReader = activityReader;
    this.#entitlementReader = entitlementReader;
  }

  async findDormantSince(userId: string): Promise<string | null> {
    const [owner] = await this.#activityReader.findActiveAccounts([userId]);
    if (owner == null || !isSeriesOwnerDormant(owner, now())) {
      return null;
    }
    const { tier } = await this.#entitlementReader.getAccessSnapshot(userId);
    return isExemptFromDormancy(tier) ? null : toDateString(owner.lastActiveAt ?? owner.signedUpAt);
  }
}
